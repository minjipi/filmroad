package com.filmroad.api.domain.place;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.comment.PostComment;
import com.filmroad.api.domain.comment.PostCommentRepository;
import com.filmroad.api.domain.follow.UserFollowRepository;
import com.filmroad.api.domain.like.PhotoLikeRepository;
import com.filmroad.api.domain.place.dto.GroupPhotoSummary;
import com.filmroad.api.domain.place.dto.PhotoDetailAuthorDto;
import com.filmroad.api.domain.place.dto.PhotoDetailCommentDto;
import com.filmroad.api.domain.place.dto.PhotoDetailPlaceDto;
import com.filmroad.api.domain.place.dto.PhotoDetailResponse;
import com.filmroad.api.domain.place.dto.PhotoDetailWorkDto;
import com.filmroad.api.domain.saved.SavedPlaceRepository;
import com.filmroad.api.domain.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 단건 사진 상세 조회. visibility 규칙(viewer=owner, PUBLIC, FOLLOWERS+팔로우) 을 서비스 단에서 검사하고,
 * 권한 없음은 존재 여부를 드러내지 않도록 `PHOTO_NOT_FOUND(404)` 로 통일.
 */
@Service
@RequiredArgsConstructor
public class PhotoDetailService {

    private static final int COMMENT_PREVIEW_LIMIT = 3;

    private final PlacePhotoRepository placePhotoRepository;
    private final PostCommentRepository postCommentRepository;
    private final PhotoLikeRepository photoLikeRepository;
    private final SavedPlaceRepository savedPlaceRepository;
    private final UserFollowRepository userFollowRepository;
    private final CurrentUser currentUser;

    @Transactional(readOnly = true)
    public PhotoDetailResponse getPhoto(Long photoId) {
        Long viewerId = currentUser.currentUserId();
        PlacePhoto photo = placePhotoRepository.findById(photoId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.PHOTO_NOT_FOUND));

        if (!canView(photo, viewerId)) {
            // 존재는 하나 권한 없음 — PRIVATE enumeration 방지 위해 동일하게 404.
            throw BaseException.of(BaseResponseStatus.PHOTO_NOT_FOUND);
        }

        Place place = photo.getPlace();
        List<PostComment> commentPreview = postCommentRepository
                .findPageByPhoto(photoId, 0L, PageRequest.of(0, COMMENT_PREVIEW_LIMIT));
        long totalComments = photo.getCommentCount();
        int moreComments = (int) Math.max(0, totalComments - commentPreview.size());

        PhotoDetailAuthorDto author = photo.getUser() != null
                ? PhotoDetailAuthorDto.of(photo.getUser(), viewerId)
                : PhotoDetailAuthorDto.fallback(photo.getAuthorNickname());

        boolean liked = viewerId != null
                && photoLikeRepository.existsByUserIdAndPlacePhotoId(viewerId, photoId);
        boolean saved = viewerId != null && place != null
                && savedPlaceRepository.existsByUserIdAndPlaceId(viewerId, place.getId());

        // 같은 batch(groupKey) 의 photo 전부를 orderIndex ASC 로 — visibility 필터는 쿼리에서 처리됨.
        List<GroupPhotoSummary> groupPhotos = placePhotoRepository
                .findAllByGroupKeyOrderByOrderIndexAsc(photo.getGroupKey(), viewerId)
                .stream()
                .map(GroupPhotoSummary::from)
                .toList();

        return PhotoDetailResponse.builder()
                .id(photo.getId())
                .imageUrl(photo.getImageUrl())
                .dramaSceneImageUrl(place == null ? null : place.getSceneImageUrl())
                .caption(photo.getCaption())
                .tags(parseTags(photo.getTagsCsv()))
                .visibility(photo.getVisibility())
                .createdAt(photo.getCreatedAt())
                .likeCount(photo.getLikeCount())
                .commentCount((int) totalComments)
                .liked(liked)
                .saved(saved)
                .author(author)
                .place(PhotoDetailPlaceDto.from(place))
                .work(place == null ? null : PhotoDetailWorkDto.of(place.getWork(), place))
                .topComments(commentPreview.stream()
                        .map(PhotoDetailCommentDto::from)
                        .toList())
                .moreCommentsCount(moreComments)
                .groupPhotos(groupPhotos)
                .build();
    }

    private boolean canView(PlacePhoto photo, Long viewerId) {
        PhotoVisibility v = photo.getVisibility();
        if (v == null || v == PhotoVisibility.PUBLIC) return true;
        User owner = photo.getUser();
        if (owner == null) {
            // user 가 없는 시드 사진은 author_nickname 뿐이라 PRIVATE/FOLLOWERS 판단 기준이 모호.
            // PUBLIC 로 간주 — 실제 운영 업로드 경로에서는 항상 user 가 채워짐.
            return true;
        }
        if (viewerId != null && viewerId.equals(owner.getId())) return true;
        if (v == PhotoVisibility.FOLLOWERS && viewerId != null) {
            return userFollowRepository.existsByFollowerIdAndFolloweeId(viewerId, owner.getId());
        }
        return false;
    }

    private static List<String> parseTags(String tagsCsv) {
        if (tagsCsv == null || tagsCsv.isBlank()) return List.of();
        return Arrays.stream(tagsCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }
}
