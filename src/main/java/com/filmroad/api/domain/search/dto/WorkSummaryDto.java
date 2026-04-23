package com.filmroad.api.domain.search.dto;

import com.filmroad.api.domain.work.Work;
import com.filmroad.api.domain.work.WorkType;
import lombok.Builder;
import lombok.Getter;

/**
 * 통합 검색 결과의 작품 섹션 단건. 필요한 최소 메타만 노출.
 */
@Getter
@Builder
public class WorkSummaryDto {
    private Long id;
    private String title;
    private WorkType type;
    private String posterUrl;
    private int placeCount;

    public static WorkSummaryDto of(Work work, int placeCount) {
        return WorkSummaryDto.builder()
                .id(work.getId())
                .title(work.getTitle())
                .type(work.getType())
                .posterUrl(work.getPosterUrl())
                .placeCount(placeCount)
                .build();
    }
}
