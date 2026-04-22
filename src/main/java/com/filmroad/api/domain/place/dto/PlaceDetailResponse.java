package com.filmroad.api.domain.place.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class PlaceDetailResponse {
    private PlaceFullDto place;
    private List<PlacePhotoDto> photos;
    private List<RelatedPlaceDto> related;
}
