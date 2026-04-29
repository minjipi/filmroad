package com.filmroad.api.domain.feed;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.util.GeoUtils;
import com.filmroad.api.domain.feed.dto.FeedAuthorDto;
import com.filmroad.api.domain.feed.dto.FeedPlaceDto;
import com.filmroad.api.domain.feed.dto.FeedPostDto;
import com.filmroad.api.domain.feed.dto.FeedResponse;
import com.filmroad.api.domain.feed.dto.FeedUserDto;
import com.filmroad.api.domain.feed.dto.FeedContentDto;
import com.filmroad.api.domain.follow.UserFollowRepository;
import com.filmroad.api.domain.like.PhotoLikeRepository;
import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlacePhoto;
import com.filmroad.api.domain.place.PlacePhotoRepository;
import com.filmroad.api.domain.saved.SavedPlaceRepository;
import com.filmroad.api.domain.stamp.Stamp;
import com.filmroad.api.domain.stamp.StampRepository;
import com.filmroad.api.domain.user.User;
import com.filmroad.api.domain.user.UserRepository;
import com.filmroad.api.domain.content.Content;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FeedService {

    private static final int DEFAULT_LIMIT = 5;
    private static final int MAX_LIMIT = 20;
    private static final int RECOMMENDED_DEFAULT = 4;

    private final PlacePhotoRepository placePhotoRepository;
    private final SavedPlaceRepository savedPlaceRepository;
    private final StampRepository stampRepository;
    private final UserRepository userRepository;
    private final PhotoLikeRepository photoLikeRepository;
    private final UserFollowRepository userFollowRepository;
    private final CurrentUser currentUser;

    @Transactional(readOnly = true)
    public FeedResponse getFeed(FeedTab tab, Long contentId, Double lat, Double lng, Long cursor, int limit) {
        FeedTab effectiveTab = tab == null ? FeedTab.RECENT : tab;
        int safeLimit = limit <= 0 ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);
        int fetchSize = safeLimit + 1;

        Long viewerId = currentUser.currentUserId();
        Long effectiveContentId = (effectiveTab == FeedTab.BY_CONTENT) ? contentId : null;
        List<PlacePhoto> fetched = switch (effectiveTab) {
            case RECENT -> placePhotoRepository.findFeedRecent(null, cursor, viewerId, PageRequest.of(0, fetchSize));
            case POPULAR -> placePhotoRepository.findFeedPopular(null, cursor, viewerId, PageRequest.of(0, fetchSize));
            case FOLLOWING -> placePhotoRepository.findFeedByFollowedUsers(viewerId, null, cursor, PageRequest.of(0, fetchSize));
            case BY_CONTENT -> placePhotoRepository.findFeedPopular(effectiveContentId, cursor, viewerId, PageRequest.of(0, fetchSize));
            case NEARBY -> fetchNearby(cursor, fetchSize, lat, lng, viewerId);
        };

        boolean hasMore = fetched.size() > safeLimit;
        List<PlacePhoto> page = hasMore ? fetched.subList(0, safeLimit) : fetched;
        Long nextCursor = hasMore && !page.isEmpty() ? page.get(page.size() - 1).getId() : null;

        List<Long> photoIds = page.stream().map(PlacePhoto::getId).toList();
        Set<Long> likedPhotoIds = photoIds.isEmpty()
                ? Set.of()
                : new HashSet<>(photoLikeRepository.findPhotoIdsLikedByUser(viewerId, photoIds));
        // 페이지 내 distinct author 들에 대해 viewer 가 follow 중인 ID 만 한번에 조회
        // — N개 포스트 = 1 쿼리. viewer 비로그인이거나 author 없는 케이스는 빈 set.
        Set<Long> authorIds = page.stream()
                .map(p -> p.getUser() == null ? null : p.getUser().getId())
                .filter(id -> id != null && !id.equals(viewerId))
                .collect(Collectors.toSet());
        Set<Long> followedAuthorIds = (viewerId == null || authorIds.isEmpty())
                ? Set.of()
                : new HashSet<>(userFollowRepository.findFolloweeIdsByFollowerAndFolloweeIdIn(viewerId, authorIds));
        List<FeedPostDto> posts = page.stream()
                .map(p -> toPostDto(p, viewerId, likedPhotoIds.contains(p.getId()), followedAuthorIds))
                .toList();

        return FeedResponse.builder()
                .posts(posts)
                .recommendedUsers(null)
                .hasMore(hasMore)
                .nextCursor(nextCursor)
                .build();
    }

    @Transactional(readOnly = true)
    public List<FeedUserDto> getRecommendedUsers(Long contentId, int limit) {
        int safeLimit = limit <= 0 ? RECOMMENDED_DEFAULT : Math.min(limit, 20);
        // aggregate는 safeLimit + 1 넉넉히 받아서 본인 제외 후에도 limit 채울 수 있게.
        List<Object[]> rows = stampRepository.aggregateUserStampCount(contentId, PageRequest.of(0, safeLimit + 1));
        Long viewerId = currentUser.currentUserId();

        List<Long> userIds = rows.stream()
                .map(r -> (Long) r[0])
                .filter(uid -> !uid.equals(viewerId))
                .limit(safeLimit)
                .toList();
        if (userIds.isEmpty()) return List.of();

        Map<Long, User> byId = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        Set<Long> followedIds = new HashSet<>(
                userFollowRepository.findFolloweeIdsByFollowerAndFolloweeIdIn(viewerId, userIds));

        String contentTitle = null;
        List<FeedUserDto> result = new ArrayList<>();
        for (Object[] row : rows) {
            Long uid = (Long) row[0];
            if (uid.equals(viewerId)) continue;
            if (!byId.containsKey(uid)) continue;
            long count = ((Number) row[1]).longValue();
            User u = byId.get(uid);
            result.add(FeedUserDto.builder()
                    .userId(u.getId())
                    .handle(u.getHandle())
                    .nickname(u.getNickname())
                    .avatarUrl(u.getAvatarUrl())
                    .verified(u.isVerified())
                    .contentTitle(contentTitle)
                    .stampCountForContent(count)
                    .following(followedIds.contains(u.getId()))
                    .build());
            if (result.size() >= safeLimit) break;
        }
        return result;
    }

    private List<PlacePhoto> fetchNearby(Long cursor, int fetchSize, Double lat, Double lng, Long viewerId) {
        List<PlacePhoto> recent = placePhotoRepository.findFeedRecent(null, cursor, viewerId, PageRequest.of(0, fetchSize * 3));
        if (lat == null || lng == null) {
            return recent.size() > fetchSize ? recent.subList(0, fetchSize) : recent;
        }
        return recent.stream()
                .sorted(Comparator.comparingDouble(p ->
                        GeoUtils.haversineKm(lat, lng, p.getPlace().getLatitude(), p.getPlace().getLongitude())))
                .limit(fetchSize)
                .toList();
    }

    private FeedPostDto toPostDto(PlacePhoto photo, Long viewerId, boolean liked, Set<Long> followedAuthorIds) {
        Place place = photo.getPlace();
        Content content = place.getContent();
        // sceneCompare: 1:N scene 컬렉션이 비어있지 않고(=등록된 씬이 1장이라도 있고)
        // photo.id 가 짝수일 때만 비교 카드 노출 (기존 demo 토글 규칙 유지).
        String primaryScene = place.getPrimarySceneImageUrl();
        boolean sceneCompare = primaryScene != null && photo.getId() % 2L == 0L;
        Optional<Stamp> stamp = stampRepository.findByUserIdAndPlaceId(viewerId, place.getId());
        boolean saved = savedPlaceRepository.existsByUserIdAndPlaceId(viewerId, place.getId());

        return FeedPostDto.builder()
                .id(photo.getId())
                .imageUrl(photo.getPrimaryImageUrl())
                .caption(photo.getCaption())
                .createdAt(photo.getCreatedAt())
                .sceneCompare(sceneCompare)
                .dramaSceneImageUrl(sceneCompare ? primaryScene : null)
                .author(resolveAuthor(photo, followedAuthorIds))
                .place(FeedPlaceDto.builder()
                        .id(place.getId())
                        .name(place.getName())
                        .regionLabel(place.getRegionLabel())
                        .build())
                .content(FeedContentDto.builder()
                        .id(content.getId())
                        .title(content.getTitle())
                        .contentEpisode(place.getPrimaryContentEpisode())
                        .sceneTimestamp(place.getPrimarySceneTimestamp())
                        .build())
                .likeCount(photo.getLikeCount())
                .commentCount(photo.getCommentCount())
                .liked(liked)
                .saved(saved)
                .visitedAt(stamp.map(Stamp::getAcquiredAt).orElse(null))
                .build();
    }

    private FeedAuthorDto resolveAuthor(PlacePhoto photo, Set<Long> followedAuthorIds) {
        User u = photo.getUser();
        if (u != null) {
            return FeedAuthorDto.builder()
                    .userId(u.getId())
                    .handle(u.getHandle())
                    .nickname(u.getNickname())
                    .avatarUrl(u.getAvatarUrl())
                    .verified(u.isVerified())
                    .following(followedAuthorIds.contains(u.getId()))
                    .build();
        }
        String nickname = photo.getAuthorNickname();
        return FeedAuthorDto.builder()
                .userId(null)
                .handle(nickname == null || nickname.isBlank() ? null : "@" + nickname)
                .nickname(nickname)
                .avatarUrl(null)
                .verified(false)
                .following(false)
                .build();
    }
}
