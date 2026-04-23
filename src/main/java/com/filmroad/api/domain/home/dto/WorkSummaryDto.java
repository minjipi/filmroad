package com.filmroad.api.domain.home.dto;

import com.filmroad.api.domain.work.Work;
import com.filmroad.api.domain.work.WorkType;
import lombok.Builder;
import lombok.Getter;

/**
 * 홈 응답의 작품 관련 DTO. `works[]` (필터 칩용, 경량) 와 `popularWorks[]` (인기 작품 섹션, 포스터/집계치 포함)
 * 양쪽에서 재사용한다. chip 용도로는 `from(Work)` 가 id/title 만 채우고, 인기 섹션은 `popular(...)` 가
 * 집계치까지 합쳐 빌드한다.
 */
@Getter
@Builder
public class WorkSummaryDto {
    private Long id;
    private String title;
    // 아래 필드는 `popularWorks` 용. 필터 칩 경로에서는 null 로 유지.
    private WorkType type;
    private String posterUrl;
    private Integer placeCount;
    private Integer trendingScore;

    public static WorkSummaryDto from(Work work) {
        return WorkSummaryDto.builder()
                .id(work.getId())
                .title(work.getTitle())
                .build();
    }

    public static WorkSummaryDto popular(Work work, int placeCount, int trendingScore) {
        return WorkSummaryDto.builder()
                .id(work.getId())
                .title(work.getTitle())
                .type(work.getType())
                .posterUrl(work.getPosterUrl())
                .placeCount(placeCount)
                .trendingScore(trendingScore)
                .build();
    }
}
