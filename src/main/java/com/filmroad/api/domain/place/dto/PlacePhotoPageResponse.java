package com.filmroad.api.domain.place.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class PlacePhotoPageResponse {
    private GalleryPlaceHeaderDto place;
    private List<GalleryPhotoDto> photos;
    private long total;
    private int page;
    private int size;
    private String sort;
}
