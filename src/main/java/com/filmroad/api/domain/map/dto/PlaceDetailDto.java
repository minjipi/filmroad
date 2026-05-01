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

    /**
     * @param photoCount viewer 가 볼 수 있는 사진 수. Place.photo_count 컬럼은
     *     denormalized 라 갱신되지 않아 stale (대부분 0) — Service 가
     *     PlacePhotoRepository.countVisibleByPlaceId 로 실시간 카운트해 명시적
     *     으로 넣어준다.
     */
    public static PlaceDetailDto of(Place place, Double distanceKm, boolean liked, long photoCount) {
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
                .photoCount((int) photoCount)
                .likeCount(place.getLikeCount())
                .rating(place.getRating())
                .distanceKm(distanceKm)
                .liked(liked)
                .build();
    }
}
