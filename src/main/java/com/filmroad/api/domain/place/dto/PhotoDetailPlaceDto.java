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
    // address 필드는 Audit Med Risk 2번에 따라 ShotDetail 응답에서 제거.
    // Place 엔티티의 address 컬럼은 그대로 보존 (다른 도메인 사용 여지).
    private Double latitude;
    private Double longitude;

    public static PhotoDetailPlaceDto from(Place place) {
        if (place == null) return null;
        return PhotoDetailPlaceDto.builder()
                .id(place.getId())
                .name(place.getName())
                .regionLabel(place.getRegionLabel())
                .latitude(place.getLatitude())
                .longitude(place.getLongitude())
                .build();
    }
}
