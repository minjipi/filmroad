package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceCoverImage;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class PlaceFullDto {
    private Long id;
    private String name;
    private String regionLabel;
    private Double latitude;
    private Double longitude;
    private List<String> coverImageUrls;
    private Long workId;
    private String workTitle;
    /**
     * 작품 씬(scene) 목록 — `imageOrderIndex` ASC. 0 번이 대표.
     * 회차/타임스탬프/설명/이미지URL 4종은 모두 이 안에 들어가며, place 평면 필드에서는 제거됨.
     * 등록된 씬이 없으면 빈 리스트(null 아님).
     */
    private List<PlaceSceneDto> scenes;
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
                .coverImageUrls(place.getCoverImages().stream().map(PlaceCoverImage::getImageUrl).toList())
                .workId(place.getWork().getId())
                .workTitle(place.getWork().getTitle())
                .scenes(place.getSceneImages().stream().map(PlaceSceneDto::from).toList())
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
