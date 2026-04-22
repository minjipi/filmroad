package com.filmroad.api.domain.work.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class WorkProgressSummaryDto {
    private long collectedCount;
    private long totalCount;
    private int percent;
    private String nextBadgeText;
}
