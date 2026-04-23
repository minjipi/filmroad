package com.filmroad.api.domain.home.dto;

import com.filmroad.api.domain.place.Place;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PlaceSummaryDto {
    private Long id;
    private String name;
    private String regionLabel;
    private String coverImageUrl;
    private Long workId;
    private String workTitle;
    private boolean liked;

    public static PlaceSummaryDto from(Place place, boolean liked) {
        return PlaceSummaryDto.builder()
                .id(place.getId())
                .name(place.getName())
                .regionLabel(place.getRegionLabel())
                .coverImageUrl(place.getCoverImageUrl())
                .workId(place.getWork().getId())
                .workTitle(place.getWork().getTitle())
                .liked(liked)
                .build();
    }
}
