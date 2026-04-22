package com.filmroad.api.domain.home.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class HomeResponse {
    private HeroDto hero;
    private List<WorkSummaryDto> works;
    private List<PlaceSummaryDto> places;
}
