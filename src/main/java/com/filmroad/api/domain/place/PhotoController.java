package com.filmroad.api.domain.place;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.like.LikeService;
import com.filmroad.api.domain.like.dto.LikeToggleResponse;
import com.filmroad.api.domain.place.dto.PhotoDetailResponse;
import com.filmroad.api.domain.place.dto.PhotoUploadRequest;
import com.filmroad.api.domain.place.dto.PhotoUploadResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
}
