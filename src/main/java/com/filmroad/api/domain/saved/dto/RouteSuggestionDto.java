package com.filmroad.api.domain.saved.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RouteSuggestionDto {
    private String title;
    private String subtitle;
    private int placeCount;
}
