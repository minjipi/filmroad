package com.filmroad.api.domain.place;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.comment.PostComment;
import com.filmroad.api.domain.comment.PostCommentRepository;
import com.filmroad.api.domain.follow.UserFollowRepository;
import com.filmroad.api.domain.like.PhotoLikeRepository;
import com.filmroad.api.domain.place.dto.PhotoImageSummary;
import com.filmroad.api.domain.place.dto.PlaceSceneDto;
import com.filmroad.api.domain.place.dto.PhotoDetailAuthorDto;
import com.filmroad.api.domain.place.dto.PhotoDetailCommentDto;
import com.filmroad.api.domain.place.dto.PhotoDetailPlaceDto;
import com.filmroad.api.domain.place.dto.PhotoDetailResponse;
import com.filmroad.api.domain.place.dto.PhotoDetailContentDto;
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
        // permitAll 엔드포인트라 viewerId 는 null 일 수 있다. 아래의 canView /
        // liked / saved / authorFollowing 분기가 모두 viewerId == null 가드를 갖고 있어
        // 비로그인 viewer 에게 PUBLIC 사진만 보이고 personalized flag 들은 false 로 떨어진다.
        Long viewerId = currentUser.currentUserIdOrNull();
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

        // viewer 가 author 를 follow 중인지 — 한 개 사진이라 단일 exists 쿼리로 충분.
        // viewerId == null 또는 isMe 면 무조건 false.
        boolean authorFollowing = false;
        if (photo.getUser() != null && viewerId != null && !viewerId.equals(photo.getUser().getId())) {
            authorFollowing = userFollowRepository.existsByFollowerIdAndFolloweeId(viewerId, photo.getUser().getId());
        }
        PhotoDetailAuthorDto author = photo.getUser() != null
                ? PhotoDetailAuthorDto.of(photo.getUser(), viewerId, authorFollowing)
                : PhotoDetailAuthorDto.fallback(photo.getAuthorNickname());

        boolean liked = viewerId != null
                && photoLikeRepository.existsByUserIdAndPlacePhotoId(viewerId, photoId);
        boolean saved = viewerId != null && place != null
                && savedPlaceRepository.existsByUserIdAndPlaceId(viewerId, place.getId());

        // PlacePhoto.images 는 @OrderBy("imageOrderIndex ASC") 자동 정렬. visibility 검사는 post 단위에서 이미 통과한 상태.
        List<PhotoImageSummary> images = photo.getImages().stream()
                .map(PhotoImageSummary::from)
                .toList();

        return PhotoDetailResponse.builder()
                .id(photo.getId())
                .imageUrl(photo.getPrimaryImageUrl())
                .scenes(place == null
                        ? List.of()
                        : place.getSceneImages().stream().map(PlaceSceneDto::from).toList())
                .caption(photo.getCaption())
                .tags(parseTags(photo.getTagsCsv()))
                .visibility(photo.getVisibility())
                .createdAt(photo.getCreatedAt())
                .likeCount(photo.getLikeCount())
                .commentCount((int) totalComments)
                .liked(liked)
                .saved(saved)
                .totalScore(photo.getTotalScore())
                .similarityScore(photo.getSimilarityScore())
                .gpsScore(photo.getGpsScore())
                .capturedLatitude(photo.getCapturedLatitude())
                .capturedLongitude(photo.getCapturedLongitude())
                .author(author)
                .place(PhotoDetailPlaceDto.from(place))
                .content(place == null ? null : PhotoDetailContentDto.of(place.getContent(), place))
                .topComments(commentPreview.stream()
                        .map(PhotoDetailCommentDto::from)
                        .toList())
                .moreCommentsCount(moreComments)
                .images(images)
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
