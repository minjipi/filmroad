package com.filmroad.api.domain.place;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.like.LikeService;
import com.filmroad.api.domain.like.dto.LikeToggleResponse;
import com.filmroad.api.domain.place.dto.PlaceDetailResponse;
import com.filmroad.api.domain.place.dto.PlaceKakaoInfoResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
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
    private final KakaoPlaceInfoService kakaoPlaceInfoService;

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

    /**
     * 카카오 Local API 기반 장소 메타데이터(주소/전화/카테고리/카카오맵 URL) + 주변 맛집/카페.
     *
     * <p>카카오 키 미설정/장애 시에도 200 + {@code available=false} 페이로드로 응답해
     * 프론트엔드가 섹션을 자연스럽게 숨길 수 있게 한다(404 X).</p>
     */
    @Operation(summary = "장소 카카오맵 메타데이터 + 주변 맛집/카페 조회",
            description = "PlaceDetailPage 의 kakao-section 데이터. 키 미설정/장애 시 available=false 응답.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "정상 응답 (available=false 포함)"),
            @ApiResponse(responseCode = "404", description = "존재하지 않는 placeId")
    })
    @GetMapping("/{id}/kakao-info")
    public BaseResponse<PlaceKakaoInfoResponse> getKakaoInfo(@PathVariable Long id) {
        return BaseResponse.success(kakaoPlaceInfoService.getOrFetch(id));
    }
}
