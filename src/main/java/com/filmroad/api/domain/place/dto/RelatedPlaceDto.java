package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceCoverImage;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class RelatedPlaceDto {
    private Long id;
    private String name;
    private List<String> coverImageUrls;
    private String workEpisode;
    private String regionShort;
    private Long workId;

    public static RelatedPlaceDto from(Place place) {
        return RelatedPlaceDto.builder()
                .id(place.getId())
                .name(place.getName())
                .coverImageUrls(place.getCoverImages().stream().map(PlaceCoverImage::getImageUrl).toList())
                .workEpisode(place.getWorkEpisode())
                .regionShort(shortenRegion(place.getRegionLabel()))
                .workId(place.getWork().getId())
                .build();
    }

    private static String shortenRegion(String regionLabel) {
        if (regionLabel == null || regionLabel.isBlank()) {
            return "";
        }
        String[] parts = regionLabel.trim().split("\\s+");
        String last = parts[parts.length - 1];
        if (last.endsWith("읍") || last.endsWith("면") || last.endsWith("동")) {
            return last.substring(0, last.length() - 1);
        }
        return last;
    }
}
