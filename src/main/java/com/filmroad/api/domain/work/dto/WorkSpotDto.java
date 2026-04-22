package com.filmroad.api.domain.work.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.Date;

@Getter
@Builder
public class WorkSpotDto {
    private Long placeId;
    private String name;
    private String regionShort;
    private String coverImageUrl;
    private String workEpisode;
    private String sceneTimestamp;
    private String sceneDescription;
    private boolean visited;
    private Date visitedAt;
    private Long orderIndex;
}
