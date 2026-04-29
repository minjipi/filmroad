package com.filmroad.api.domain.place;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.comment.PostCommentRepository;
import com.filmroad.api.domain.like.PhotoLikeRepository;
import com.filmroad.api.domain.place.dto.PhotoUpdateRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * ShotDetail 더보기 메뉴의 "수정" / "삭제" 두 액션을 담당. 작성자 본인만 호출
 * 가능 — owner 검증은 두 메서드 모두 명시적으로 수행하고, 권한 없음은
 * PHOTO_UNAUTHORIZED(40071) 로 통일.
 *
 * <p>삭제는 hard delete — DB 에서 즉시 행을 지운다. PlacePhoto 의
 * orphanRemoval 로 PlacePhotoImage 는 자동 cascade 되지만, FK 가 PlacePhoto
 * 를 참조하는 PhotoLike / PostComment 는 별도 bulk delete 로 정리한다.
 *
 * <p>업로드 이미지 파일 (uploads/...) 은 이번 cleanup 에 포함하지 않는다.
 * 이유: (1) 파일 삭제 실패가 transaction rollback 에 못 끼이는 외부 효과라
 * 신중한 설계 필요, (2) 추후 orphan sweeper 로 일괄 처리하는 게 일반적.
 * DB row 레벨에서는 즉시 정리되어 사용자 perspective 에선 사진이 사라진
 * 것처럼 보임.
 */
@Service
@RequiredArgsConstructor
public class PhotoEditService {

    private final PlacePhotoRepository placePhotoRepository;
    private final PhotoLikeRepository photoLikeRepository;
    private final PostCommentRepository postCommentRepository;
    private final CurrentUser currentUser;

    /**
     * 캡션 / 공개범위 갱신. 작성자 외 호출 시 PHOTO_UNAUTHORIZED, 사진 자체가
     * 없으면 PHOTO_NOT_FOUND. 트랜잭션 안에서 dirty checking 으로 commit.
     */
    @Transactional
    public void update(Long photoId, PhotoUpdateRequest req) {
        Long viewerId = currentUser.currentUserId();
        PlacePhoto photo = placePhotoRepository.findById(photoId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.PHOTO_NOT_FOUND));
        ensureOwner(photo, viewerId);
        photo.updateContent(req.getCaption(), req.getVisibility());
    }

    /**
     * Hard delete. 자식 행(PhotoLike / PostComment) 부터 정리한 뒤 PlacePhoto
     * 자체를 지운다. PlacePhotoImage 는 PlacePhoto 의 orphanRemoval 로 자동
     * cascade — 별도 bulk delete 불필요.
     */
    @Transactional
    public void delete(Long photoId) {
        Long viewerId = currentUser.currentUserId();
        PlacePhoto photo = placePhotoRepository.findById(photoId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.PHOTO_NOT_FOUND));
        ensureOwner(photo, viewerId);

        photoLikeRepository.deleteAllByPlacePhotoId(photoId);
        postCommentRepository.deleteAllByPlacePhotoId(photoId);
        placePhotoRepository.delete(photo);
    }

    private static void ensureOwner(PlacePhoto photo, Long viewerId) {
        if (photo.getUser() == null || viewerId == null
                || !viewerId.equals(photo.getUser().getId())) {
            throw BaseException.of(BaseResponseStatus.PHOTO_UNAUTHORIZED);
        }
    }
}
