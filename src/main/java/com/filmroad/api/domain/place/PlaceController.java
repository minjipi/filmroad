package com.filmroad.api.domain.place;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.like.LikeService;
import com.filmroad.api.domain.like.dto.LikeToggleResponse;
import com.filmroad.api.domain.place.dto.PlaceDetailResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/places")
@RequiredArgsConstructor
@Validated
public class PlaceController {

    private final PlaceDetailService placeDetailService;
    private final LikeService likeService;

    @GetMapping("/{id}")
    public BaseResponse<PlaceDetailResponse> getPlaceDetail(
            @PathVariable Long id,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng
    ) {
        return BaseResponse.success(placeDetailService.getPlaceDetail(id, lat, lng));
    }

    @PostMapping("/{id}/like")
    public BaseResponse<LikeToggleResponse> togglePlaceLike(@PathVariable Long id) {
        return BaseResponse.success(likeService.togglePlaceLike(id));
    }
}
