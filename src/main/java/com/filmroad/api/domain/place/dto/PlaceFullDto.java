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
    private Long contentId;
    private String contentTitle;
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

    /**
     * @param photoCount viewer 가 볼 수 있는 사진 수. Place 의 denormalized
     *     photo_count 컬럼은 업로드 시 갱신되지 않아 stale 한 케이스가 잦음
     *     (대부분 0) — Service 가 PlacePhotoRepository.countVisibleByPlaceId 로
     *     실시간 카운트해 명시적으로 넣어준다.
     */
    public static PlaceFullDto of(Place place, Double distanceKm, Integer driveTimeMin,
                                  boolean liked, long photoCount) {
        return PlaceFullDto.builder()
                .id(place.getId())
                .name(place.getName())
                .regionLabel(place.getRegionLabel())
                .latitude(place.getLatitude())
                .longitude(place.getLongitude())
                .coverImageUrls(place.getCoverImages().stream().map(PlaceCoverImage::getImageUrl).toList())
                .contentId(place.getContent().getId())
                .contentTitle(place.getContent().getTitle())
                .scenes(place.getSceneImages().stream().map(PlaceSceneDto::from).toList())
                .rating(place.getRating())
                .reviewCount(place.getReviewCount())
                .photoCount((int) photoCount)
                .likeCount(place.getLikeCount())
                .liked(liked)
                // Place 의 nearby_restaurant_count 컬럼도 stale (0 고정) — 프론트가
                // tourNearby 응답 .length 로 자체 표시하므로 0 으로 박아 둔다.
                .nearbyRestaurantCount(0)
                .recommendedTimeLabel(place.getRecommendedTimeLabel())
                .distanceKm(distanceKm)
                .driveTimeMin(driveTimeMin)
                .build();
    }
}
