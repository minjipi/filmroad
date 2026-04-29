package com.filmroad.api.domain.place;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.like.LikeService;
import com.filmroad.api.domain.like.dto.LikeToggleResponse;
import com.filmroad.api.domain.place.dto.PhotoDetailResponse;
import com.filmroad.api.domain.place.dto.PhotoUpdateRequest;
import com.filmroad.api.domain.place.dto.PhotoUploadRequest;
import com.filmroad.api.domain.place.dto.PhotoUploadResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/photos")
@RequiredArgsConstructor
@Validated
public class PhotoController {

    private final PhotoUploadService photoUploadService;
    private final PhotoDetailService photoDetailService;
    private final PhotoEditService photoEditService;
    private final LikeService likeService;

    /**
     * 멀티 파일 업로드 — `files` 파트 이름으로 1~5장까지. 단일 업로드도 `files=...` 로 보낸다.
     * meta 는 그대로 `meta` 파트에 JSON.
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public BaseResponse<PhotoUploadResponse> upload(
            @RequestPart("files") java.util.List<MultipartFile> files,
            @RequestPart("meta") @Valid PhotoUploadRequest meta
    ) {
        return BaseResponse.success(photoUploadService.upload(files, meta));
    }

    /** ShotDetailPage 용 단건 사진 상세. PUBLIC / 본인 / FOLLOWERS+팔로우 만 조회 가능, 나머지는 404. */
    @GetMapping("/{id}")
    public BaseResponse<PhotoDetailResponse> getPhoto(@PathVariable Long id) {
        return BaseResponse.success(photoDetailService.getPhoto(id));
    }

    @PostMapping("/{id}/like")
    public BaseResponse<LikeToggleResponse> togglePhotoLike(@PathVariable Long id) {
        return BaseResponse.success(likeService.togglePhotoLike(id));
    }

    /**
     * 작성자 수정 — caption / 공개범위 만 갱신. 권한 없음 → PHOTO_UNAUTHORIZED.
     * 응답은 갱신 후의 PhotoDetailResponse 를 다시 내려보내 프런트가 별도
     * refetch 없이 화면을 즉시 갱신할 수 있게 한다.
     */
    @PatchMapping("/{id}")
    public BaseResponse<PhotoDetailResponse> updatePhoto(
            @PathVariable Long id,
            @Valid @RequestBody PhotoUpdateRequest req
    ) {
        photoEditService.update(id, req);
        return BaseResponse.success(photoDetailService.getPhoto(id));
    }

    /**
     * 작성자 hard delete. 자식 행(좋아요/댓글) cascade 정리 포함.
     * 응답 body 는 비어 있어도 SUCCESS status 만 의미 있음.
     */
    @DeleteMapping("/{id}")
    public BaseResponse<Void> deletePhoto(@PathVariable Long id) {
        photoEditService.delete(id);
        return BaseResponse.success(null);
    }
}
