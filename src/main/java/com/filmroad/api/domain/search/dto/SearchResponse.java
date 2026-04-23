package com.filmroad.api.domain.search.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * `GET /api/search` 응답 바디. query 는 서버가 정규화한 문자열을 echo 해 프론트가 debounce/하이라이팅에 활용.
 */
@Getter
@Builder
public class SearchResponse {
    private String query;
    private List<WorkSummaryDto> works;
    private List<PlaceSummaryDto> places;
}
