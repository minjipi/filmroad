package com.filmroad.api.domain.place.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class GalleryPlaceHeaderDto {
    private Long placeId;
    private String name;
    private String workTitle;
    private String workEpisode;
    private long totalPhotoCount;
}
