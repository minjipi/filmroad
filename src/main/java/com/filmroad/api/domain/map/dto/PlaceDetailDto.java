package com.filmroad.api.domain.map.dto;

import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceCoverImage;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class PlaceDetailDto {
    private Long id;
    private String name;
    private String regionLabel;
    private Double latitude;
    private Double longitude;
    private Long contentId;
    private String contentTitle;
    private String contentEpisode;
    private List<String> coverImageUrls;
    private String sceneImageUrl;
    private int photoCount;
    private int likeCount;
    private double rating;
    private Double distanceKm;
    /**
     * 현재 viewer 가 이 place 를 좋아요 눌렀는지. 비로그인은 false.
     * 지도 시트의 하트 아이콘이 채움/외곽 분기에 사용한다.
     */
    private boolean liked;

    public static PlaceDetailDto of(Place place, Double distanceKm, boolean liked) {
        return PlaceDetailDto.builder()
                .id(place.getId())
                .name(place.getName())
                .regionLabel(place.getRegionLabel())
                .latitude(place.getLatitude())
                .longitude(place.getLongitude())
                .contentId(place.getContent().getId())
                .contentTitle(place.getContent().getTitle())
                .contentEpisode(place.getPrimaryContentEpisode())
                .coverImageUrls(place.getCoverImages().stream().map(PlaceCoverImage::getImageUrl).toList())
                .sceneImageUrl(place.getPrimarySceneImageUrl())
                .photoCount(place.getPhotoCount())
                .likeCount(place.getLikeCount())
                .rating(place.getRating())
                .distanceKm(distanceKm)
                .liked(liked)
                .build();
    }
}
