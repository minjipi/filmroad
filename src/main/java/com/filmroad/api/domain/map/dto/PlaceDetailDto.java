package com.filmroad.api.domain.map.dto;

import com.filmroad.api.domain.place.Place;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PlaceDetailDto {
    private Long id;
    private String name;
    private String regionLabel;
    private Double latitude;
    private Double longitude;
    private Long workId;
    private String workTitle;
    private String workEpisode;
    private String coverImageUrl;
    private int photoCount;
    private int likeCount;
    private double rating;
    private Double distanceKm;

    public static PlaceDetailDto of(Place place, Double distanceKm) {
        return PlaceDetailDto.builder()
                .id(place.getId())
                .name(place.getName())
                .regionLabel(place.getRegionLabel())
                .latitude(place.getLatitude())
                .longitude(place.getLongitude())
                .workId(place.getWork().getId())
                .workTitle(place.getWork().getTitle())
                .workEpisode(null)
                .coverImageUrl(place.getCoverImageUrl())
                .photoCount(place.getPhotoCount())
                .likeCount(place.getLikeCount())
                .rating(place.getRating())
                .distanceKm(distanceKm)
                .build();
    }
}
