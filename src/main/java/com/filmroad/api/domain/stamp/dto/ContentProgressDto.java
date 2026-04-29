package com.filmroad.api.domain.stamp.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class WorkProgressDto {
    private Long contentId;
    private String title;
    private String posterUrl;
    private Integer year;
    private long collectedCount;
    private long totalCount;
    private int percent;
    private boolean completed;
    private String gradient;
}
