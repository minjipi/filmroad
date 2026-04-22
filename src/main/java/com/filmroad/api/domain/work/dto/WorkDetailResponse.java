package com.filmroad.api.domain.work.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class WorkDetailResponse {
    private WorkDetailDto work;
    private WorkProgressSummaryDto progress;
    private List<WorkSpotDto> spots;
}
