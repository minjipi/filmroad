package com.filmroad.api.domain.user;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.follow.UserFollowRepository;
import com.filmroad.api.domain.place.PlacePhoto;
import com.filmroad.api.domain.place.PlacePhotoRepository;
import com.filmroad.api.domain.place.PlaceRepository;
import com.filmroad.api.domain.stamp.Stamp;
import com.filmroad.api.domain.stamp.StampRepository;
import com.filmroad.api.domain.user.dto.CollectedContentDto;
import com.filmroad.api.domain.user.dto.MiniMapPinDto;
import com.filmroad.api.domain.user.dto.MyPhotoDto;
import com.filmroad.api.domain.user.dto.MyPhotosResponse;
import com.filmroad.api.domain.user.dto.ProfileResponse;
import com.filmroad.api.domain.user.dto.ProfileStatsDto;
import com.filmroad.api.domain.user.dto.PublicPhotoDto;
import com.filmroad.api.domain.user.dto.PublicUserProfileResponse;
import com.filmroad.api.domain.user.dto.PublicUserStatsDto;
import com.filmroad.api.domain.user.dto.UpdateProfileRequest;
import com.filmroad.api.domain.user.dto.UserMeDto;
import com.filmroad.api.domain.content.Content;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    // 프로필 mini-map 은 사용자가 방문한 모든 성지 좌표를 펼쳐 보여 준다 — 별도
    // cap 없이 전체 stamp 를 뿌리고, 프론트에서 setBounds 로 핀이 모두 보이게 줌을
    // 자동 맞춘다. 핀 색은 "방문" 단일 카테고리라 PRIMARY 한 색만 사용.
    private static final String DEFAULT_PIN_VARIANT = "PRIMARY";
    // ProfilePage 인증샷 grid 기본값 / 상한. 60 까지로 제한해 infinite scroll 페이지당 부담을 제한.
    private static final int MY_PHOTOS_DEFAULT_LIMIT = 30;
    private static final int MY_PHOTOS_MAX_LIMIT = 60;
    // 공개 프로필(17-user-profile.html) grid / collected-contents preview 수량.
    private static final int PUBLIC_PROFILE_COLLECTED_WORKS_LIMIT = 5;
    private static final int PUBLIC_PROFILE_PHOTO_LIMIT = 9;

    private final UserRepository userRepository;
    private final StampRepository stampRepository;
    private final PlacePhotoRepository placePhotoRepository;
    private final PlaceRepository placeRepository;
    private final UserFollowRepository userFollowRepository;
    private final CurrentUser currentUser;

    @Transactional(readOnly = true)
    public ProfileResponse getMe() {
        Long userId = currentUser.currentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.RESPONSE_NULL_ERROR));

        long visitedCount = stampRepository.countByUserId(userId);

        List<Stamp> recent = stampRepository.findByUserIdOrderByAcquiredAtDesc(userId);
        List<MiniMapPinDto> pins = recent.stream()
                .map(s -> MiniMapPinDto.builder()
                        .latitude(s.getPlace().getLatitude())
                        .longitude(s.getPlace().getLongitude())
                        .variant(DEFAULT_PIN_VARIANT)
                        .build())
                .toList();

        ProfileStatsDto stats = ProfileStatsDto.builder()
                .visitedCount(visitedCount)
                .photoCount(user.getTotalPhotoCount())
                .followersCount(user.getFollowersCount())
                .followingCount(user.getFollowingCount())
                .build();

        return ProfileResponse.builder()
                .user(UserMeDto.from(user))
                .stats(stats)
                .miniMapPins(pins)
                .build();
    }

    /**
     * 로그인 유저가 업로드한 PlacePhoto 최신순 + cursor 기반 페이지네이션.
     * 본인 것이라 visibility 필터 불필요 (PRIVATE 포함 모두 반환).
     * fetchSize = limit + 1 로 조회해 마지막 항목이 다음 페이지 존재 판정용.
     */
    @Transactional(readOnly = true)
    public MyPhotosResponse getMyPhotos(Long cursor, Integer limit) {
        int safeLimit = (limit == null || limit <= 0) ? MY_PHOTOS_DEFAULT_LIMIT
                : Math.min(limit, MY_PHOTOS_MAX_LIMIT);
        Long userId = currentUser.currentUserId();

        int fetchSize = safeLimit + 1;
        List<PlacePhoto> fetched = placePhotoRepository
                .findByUserIdOrderByIdDesc(userId, cursor, PageRequest.of(0, fetchSize));

        boolean hasMore = fetched.size() > safeLimit;
        List<PlacePhoto> page = hasMore ? fetched.subList(0, safeLimit) : fetched;
        Long nextCursor = (hasMore && !page.isEmpty()) ? page.get(page.size() - 1).getId() : null;

        return MyPhotosResponse.builder()
                .photos(page.stream().map(MyPhotoDto::from).toList())
                .nextCursor(nextCursor)
                .build();
    }

    /**
     * 공개 프로필 조회 (17-user-profile.html) — permitAll. 비로그인 viewer 는 `isMe=false`,
     * `following=false`. 대상 유저 없으면 USER_NOT_FOUND(404).
     *
     * - stats.visitedCount: stamp 총수 / photoCount: user.totalPhotoCount /
     *   collectedWorksCount: stamp 로 방문한 distinct work 수.
     * - topPhotos: viewer 기준 visibility 필터(PUBLIC / 본인 / FOLLOWERS+follow) 적용한 최신 9개.
     * - recentCollectedContents: stamp 를 work 별 집계, collectedCount/totalCount 진행률 포함.
     */
    @Transactional(readOnly = true)
    public PublicUserProfileResponse getPublicProfile(Long targetUserId) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.USER_NOT_FOUND));
        Long viewerId = currentUser.currentUserIdOrNull();

        long visitedCount = stampRepository.countByUserId(targetUserId);
        long collectedWorksCount = stampRepository.findDistinctWorkIdsByUserId(targetUserId).size();

        PublicUserStatsDto stats = PublicUserStatsDto.builder()
                .visitedCount(visitedCount)
                .photoCount(target.getTotalPhotoCount())
                .followersCount(target.getFollowersCount())
                .followingCount(target.getFollowingCount())
                .collectedWorksCount(collectedWorksCount)
                .build();

        List<CollectedContentDto> recentCollectedContents = stampRepository
                .aggregateWorksByUserId(targetUserId,
                        PageRequest.of(0, PUBLIC_PROFILE_COLLECTED_WORKS_LIMIT))
                .stream()
                .map(row -> {
                    Content w = (Content) row[0];
                    long collected = ((Number) row[1]).longValue();
                    long total = placeRepository.countByContentId(w.getId());
                    return CollectedContentDto.builder()
                            .id(w.getId())
                            .title(w.getTitle())
                            .posterUrl(w.getPosterUrl())
                            .collectedCount(collected)
                            .totalCount(total)
                            .build();
                })
                .toList();

        List<PublicPhotoDto> topPhotos = placePhotoRepository
                .findVisibleByOwnerIdOrderByIdDesc(targetUserId, viewerId,
                        PageRequest.of(0, PUBLIC_PROFILE_PHOTO_LIMIT))
                .stream()
                .map(PublicPhotoDto::from)
                .toList();

        boolean isMe = viewerId != null && viewerId.equals(targetUserId);
        boolean following = !isMe && viewerId != null
                && userFollowRepository.existsByFollowerIdAndFolloweeId(viewerId, targetUserId);

        return PublicUserProfileResponse.builder()
                .id(target.getId())
                .nickname(target.getNickname())
                .handle(target.getHandle())
                .avatarUrl(target.getAvatarUrl())
                .bio(target.getBio())
                .verified(target.isVerified())
                .level(target.getLevel())
                .levelName(UserMeDto.levelName(target.getLevel()))
                .points(target.getPoints())
                .streakDays(target.getStreakDays())
                .stats(stats)
                .isMe(isMe)
                .following(following)
                .topPhotos(topPhotos)
                .recentCollectedContents(recentCollectedContents)
                .build();
    }

    @Transactional
    public UserMeDto updateMe(UpdateProfileRequest req) {
        Long userId = currentUser.currentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.RESPONSE_NULL_ERROR));
        user.updateProfile(req.getNickname(), req.getBio(), req.getAvatarUrl());
        return UserMeDto.from(user);
    }
}
