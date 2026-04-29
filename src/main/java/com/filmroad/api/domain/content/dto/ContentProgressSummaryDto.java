package com.filmroad.api.domain.content.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ContentProgressSummaryDto {
    private long collectedCount;
    private long totalCount;
    private int percent;
    private String nextBadgeText;
}
