package com.filmroad.api.domain.place;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.like.LikeService;
import com.filmroad.api.domain.like.dto.LikeToggleResponse;
import com.filmroad.api.domain.place.dto.PhotoUploadRequest;
import com.filmroad.api.domain.place.dto.PhotoUploadResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
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
    private final LikeService likeService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public BaseResponse<PhotoUploadResponse> upload(
            @RequestPart("file") MultipartFile file,
            @RequestPart("meta") @Valid PhotoUploadRequest meta
    ) {
        return BaseResponse.success(photoUploadService.upload(file, meta));
    }

    @PostMapping("/{id}/like")
    public BaseResponse<LikeToggleResponse> togglePhotoLike(@PathVariable Long id) {
        return BaseResponse.success(likeService.togglePhotoLike(id));
    }
}
