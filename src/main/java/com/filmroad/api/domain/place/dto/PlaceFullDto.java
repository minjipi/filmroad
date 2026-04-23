package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.place.Place;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PlaceFullDto {
    private Long id;
    private String name;
    private String regionLabel;
    private Double latitude;
    private Double longitude;
    private String coverImageUrl;
    private Long workId;
    private String workTitle;
    private String workEpisode;
    private String sceneTimestamp;
    private String sceneImageUrl;
    private String sceneDescription;
    private double rating;
    private int reviewCount;
    private int photoCount;
    private int likeCount;
    private boolean liked;
    private int nearbyRestaurantCount;
    private String recommendedTimeLabel;
    private Double distanceKm;
    private Integer driveTimeMin;

    public static PlaceFullDto of(Place place, Double distanceKm, Integer driveTimeMin, boolean liked) {
        return PlaceFullDto.builder()
                .id(place.getId())
                .name(place.getName())
                .regionLabel(place.getRegionLabel())
                .latitude(place.getLatitude())
                .longitude(place.getLongitude())
                .coverImageUrl(place.getCoverImageUrl())
                .workId(place.getWork().getId())
                .workTitle(place.getWork().getTitle())
                .workEpisode(place.getWorkEpisode())
                .sceneTimestamp(place.getSceneTimestamp())
                .sceneImageUrl(place.getSceneImageUrl())
                .sceneDescription(place.getSceneDescription())
                .rating(place.getRating())
                .reviewCount(place.getReviewCount())
                .photoCount(place.getPhotoCount())
                .likeCount(place.getLikeCount())
                .liked(liked)
                .nearbyRestaurantCount(place.getNearbyRestaurantCount())
                .recommendedTimeLabel(place.getRecommendedTimeLabel())
                .distanceKm(distanceKm)
                .driveTimeMin(driveTimeMin)
                .build();
    }
}
