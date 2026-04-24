package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.place.Place;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PhotoDetailPlaceDto {
    private Long id;
    private String name;
    private String regionLabel;
    private String address;
    private Double latitude;
    private Double longitude;

    public static PhotoDetailPlaceDto from(Place place) {
        if (place == null) return null;
        return PhotoDetailPlaceDto.builder()
                .id(place.getId())
                .name(place.getName())
                .regionLabel(place.getRegionLabel())
                .address(place.getAddress())
                .latitude(place.getLatitude())
                .longitude(place.getLongitude())
                .build();
    }
}
