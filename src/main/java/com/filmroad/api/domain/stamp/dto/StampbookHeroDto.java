package com.filmroad.api.domain.stamp.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class StampbookHeroDto {
    private long contentsCollectingCount;
    private long placesCollectedCount;
    private long badgesCount;
    private long completedContentsCount;
}
