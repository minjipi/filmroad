package com.filmroad.api.domain.home.dto;

import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceCoverImage;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class PlaceSummaryDto {
    private Long id;
    private String name;
    private String regionLabel;
    private List<String> coverImageUrls;
    private Long workId;
    private String workTitle;
    private boolean liked;

    public static PlaceSummaryDto from(Place place, boolean liked) {
        return PlaceSummaryDto.builder()
                .id(place.getId())
                .name(place.getName())
                .regionLabel(place.getRegionLabel())
                .coverImageUrls(place.getCoverImages().stream().map(PlaceCoverImage::getImageUrl).toList())
                .workId(place.getWork().getId())
                .workTitle(place.getWork().getTitle())
                .liked(liked)
                .build();
    }
}
