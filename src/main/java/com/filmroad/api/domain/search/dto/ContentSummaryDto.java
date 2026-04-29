package com.filmroad.api.domain.search.dto;

import com.filmroad.api.domain.content.Content;
import com.filmroad.api.domain.content.ContentType;
import lombok.Builder;
import lombok.Getter;

/**
 * 통합 검색 결과의 작품 섹션 단건. 필요한 최소 메타만 노출.
 */
@Getter
@Builder
public class ContentSummaryDto {
    private Long id;
    private String title;
    private ContentType type;
    private String posterUrl;
    private int placeCount;

    public static ContentSummaryDto of(Content content, int placeCount) {
        return ContentSummaryDto.builder()
                .id(content.getId())
                .title(content.getTitle())
                .type(content.getType())
                .posterUrl(content.getPosterUrl())
                .placeCount(placeCount)
                .build();
    }
}
