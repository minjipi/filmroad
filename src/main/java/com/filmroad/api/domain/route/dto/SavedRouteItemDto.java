package com.filmroad.api.domain.route.dto;

import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.route.RoutePlace;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@Schema(description = "Route 응답 항목 — Place 메타 + 사용자 입력(orderIndex/durationMin/note)")
public class SavedRouteItemDto {

    private Long placeId;
    private String name;
    private String regionLabel;
    private String address;
    private Double latitude;
    private Double longitude;
    private String coverImageUrl;
    private String sceneImageUrl;
    private int orderIndex;
    private int durationMin;
    private String note;
    private double rating;

    public static SavedRouteItemDto from(RoutePlace rp) {
        Place p = rp.getPlace();
        return SavedRouteItemDto.builder()
                .placeId(p.getId())
                .name(p.getName())
                .regionLabel(p.getRegionLabel())
                .address(p.getAddress())
                .latitude(p.getLatitude())
                .longitude(p.getLongitude())
                .coverImageUrl(p.getPrimaryCoverImageUrl())
                .sceneImageUrl(p.getPrimarySceneImageUrl())
                .orderIndex(rp.getOrderIndex())
                .durationMin(rp.getDurationMin())
                .note(rp.getNote())
                .rating(p.getRating())
                .build();
    }
}
