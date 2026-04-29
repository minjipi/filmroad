package com.filmroad.api.domain.home.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class HeroDto {
    private String monthLabel;
    private String tag;
    private String title;
    private String subtitle;
    private Long contentId;
    private Long primaryPlaceId;
}
