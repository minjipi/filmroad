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
    private Long workId;
    private String workTitle;
    private String regionLabel;
    private Double distanceKm;

    public static MapMarkerDto of(Place place, Double distanceKm) {
        return MapMarkerDto.builder()
                .id(place.getId())
                .name(place.getName())
                .latitude(place.getLatitude())
                .longitude(place.getLongitude())
                .workId(place.getWork().getId())
                .workTitle(place.getWork().getTitle())
                .regionLabel(place.getRegionLabel())
                .distanceKm(distanceKm)
                .build();
    }
}
