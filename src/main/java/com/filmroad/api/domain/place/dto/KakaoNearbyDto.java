package com.filmroad.api.domain.place.dto;

import com.filmroad.api.integration.kakao.KakaoLocalResult;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class KakaoNearbyDto {
    private String name;
    /** "FD6"(맛집) 또는 "CE7"(카페). */
    private String categoryGroupCode;
    /** 예: "한식 > 해물,생선". */
    private String categoryName;
    private int distanceMeters;
    private String kakaoPlaceUrl;
    private double lat;
    private double lng;
    private String phone;

    public static KakaoNearbyDto from(KakaoLocalResult result) {
        return KakaoNearbyDto.builder()
                .name(result.placeName())
                .categoryGroupCode(result.categoryGroupCode())
                .categoryName(result.categoryName())
                .distanceMeters(result.distanceMeters() != null ? result.distanceMeters() : 0)
                .kakaoPlaceUrl(result.placeUrl())
                .lat(result.latitude() != null ? result.latitude() : 0.0)
                .lng(result.longitude() != null ? result.longitude() : 0.0)
                .phone(result.phone())
                .build();
    }
}
