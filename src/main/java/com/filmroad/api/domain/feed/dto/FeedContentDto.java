package com.filmroad.api.domain.feed.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class FeedContentDto {
    private Long id;
    private String title;
    private String contentEpisode;
    private String sceneTimestamp;
}
