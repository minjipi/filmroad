package com.filmroad.api.domain.search.dto;

import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceCoverImage;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * 통합 검색 결과의 장소 섹션 단건. 지도 점프/딥링크에 필요한 좌표·workId·썸네일만 포함.
 */
@Getter
@Builder
public class PlaceSummaryDto {
    private Long id;
    private String name;
    private String regionLabel;
    private Double latitude;
    private Double longitude;
    private Long workId;
    private String workTitle;
    private List<String> coverImageUrls;

    public static PlaceSummaryDto of(Place place) {
        return PlaceSummaryDto.builder()
                .id(place.getId())
                .name(place.getName())
                .regionLabel(place.getRegionLabel())
                .latitude(place.getLatitude())
                .longitude(place.getLongitude())
                .workId(place.getWork() == null ? null : place.getWork().getId())
                .workTitle(place.getWork() == null ? null : place.getWork().getTitle())
                .coverImageUrls(place.getCoverImages().stream().map(PlaceCoverImage::getImageUrl).toList())
                .build();
    }
}
