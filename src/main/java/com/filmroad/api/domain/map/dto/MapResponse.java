package com.filmroad.api.domain.map.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class MapResponse {
    private List<MapMarkerDto> markers;
    private PlaceDetailDto selected;
}
