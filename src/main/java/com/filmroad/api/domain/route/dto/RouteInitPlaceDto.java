package com.filmroad.api.domain.route.dto;

import com.filmroad.api.domain.place.Place;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@Schema(description = "Route init: 추천 후보 장소")
public class RouteInitPlaceDto {

    private Long placeId;
    private String name;
    private String regionLabel;
    private String address;
    private Double latitude;
    private Double longitude;
    private String coverImageUrl;
    private String sceneImageUrl;
    /** 기본 60 분. 프론트가 그대로 RouteCreateRequest 에 실어 보내거나 사용자가 조정. */
    private int durationMin;
    private double rating;

    public static RouteInitPlaceDto from(Place p) {
        return RouteInitPlaceDto.builder()
                .placeId(p.getId())
                .name(p.getName())
                .regionLabel(p.getRegionLabel())
                .address(p.getAddress())
                .latitude(p.getLatitude())
                .longitude(p.getLongitude())
                .coverImageUrl(p.getPrimaryCoverImageUrl())
                .sceneImageUrl(p.getPrimarySceneImageUrl())
                .durationMin(60)
                .rating(p.getRating())
                .build();
    }
}
