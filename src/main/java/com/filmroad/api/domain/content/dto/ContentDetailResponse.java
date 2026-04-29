package com.filmroad.api.domain.content.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class ContentDetailResponse {
    private ContentDetailDto work;
    private ContentProgressSummaryDto progress;
    private List<ContentSpotDto> spots;
}
