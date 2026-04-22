package com.filmroad.api.domain.home.dto;

import com.filmroad.api.domain.work.Work;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class WorkSummaryDto {
    private Long id;
    private String title;

    public static WorkSummaryDto from(Work work) {
        return WorkSummaryDto.builder()
                .id(work.getId())
                .title(work.getTitle())
                .build();
    }
}
