package com.filmroad.api.domain.map.dto;

import com.filmroad.api.domain.place.Place;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MapMarkerDto {
    private Long id;
    private String name;
    private Double latitude;
    private Double longitude;
    private Long contentId;
    private String contentTitle;
    private String regionLabel;
    private Double distanceKm;

    public static MapMarkerDto of(Place place, Double distanceKm) {
        return MapMarkerDto.builder()
                .id(place.getId())
                .name(place.getName())
                .latitude(place.getLatitude())
                .longitude(place.getLongitude())
                .contentId(place.getContent().getId())
                .contentTitle(place.getContent().getTitle())
                .regionLabel(place.getRegionLabel())
                .distanceKm(distanceKm)
                .build();
    }
}
