package com.filmroad.api.domain.place;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.place.dto.PlacePhotoPageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/places")
@RequiredArgsConstructor
@Validated
public class GalleryController {

    private final GalleryService galleryService;

    @GetMapping("/{placeId}/photos")
    public BaseResponse<PlacePhotoPageResponse> getPhotos(
            @PathVariable Long placeId,
            @RequestParam(required = false, defaultValue = "RECENT") String sort,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "20") int size
    ) {
        return BaseResponse.success(galleryService.getPhotos(placeId, sort, page, size));
    }
}
