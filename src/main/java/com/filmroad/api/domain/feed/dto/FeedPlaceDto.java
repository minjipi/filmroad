package com.filmroad.api.domain.feed.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class FeedPlaceDto {
    private Long id;
    private String name;
    private String regionLabel;
}
