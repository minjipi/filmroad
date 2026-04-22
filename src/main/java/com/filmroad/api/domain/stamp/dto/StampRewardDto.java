package com.filmroad.api.domain.stamp.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class StampRewardDto {
    private String placeName;
    private Long workId;
    private String workTitle;
    private long collectedCount;
    private long totalCount;
    private int percent;
}
