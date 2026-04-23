package com.filmroad.api.domain.feed.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class FeedWorkDto {
    private Long id;
    private String title;
    private String workEpisode;
    private String sceneTimestamp;
}
