package com.filmroad.api.domain.home.dto;

import com.filmroad.api.domain.content.Content;
import com.filmroad.api.domain.content.ContentType;
import lombok.Builder;
import lombok.Getter;

/**
 * 홈 응답의 작품 관련 DTO. `contents[]` (필터 칩용, 경량) 와 `popularContents[]` (인기 작품 섹션, 포스터/집계치 포함)
 * 양쪽에서 재사용한다. chip 용도로는 `from(Content)` 가 id/title 만 채우고, 인기 섹션은 `popular(...)` 가
 * 집계치까지 합쳐 빌드한다.
 */
@Getter
@Builder
public class ContentSummaryDto {
    private Long id;
    private String title;
    // 아래 필드는 `popularContents` 용. 필터 칩 경로에서는 null 로 유지.
    private ContentType type;
    private String posterUrl;
    private Integer placeCount;
    private Integer trendingScore;

    public static ContentSummaryDto from(Content content) {
        return ContentSummaryDto.builder()
                .id(content.getId())
                .title(content.getTitle())
                .build();
    }

    public static ContentSummaryDto popular(Content content, int placeCount, int trendingScore) {
        return ContentSummaryDto.builder()
                .id(content.getId())
                .title(content.getTitle())
                .type(content.getType())
                .posterUrl(content.getPosterUrl())
                .placeCount(placeCount)
                .trendingScore(trendingScore)
                .build();
    }
}
