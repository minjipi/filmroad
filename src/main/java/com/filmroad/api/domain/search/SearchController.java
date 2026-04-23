package com.filmroad.api.domain.search;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.search.dto.SearchResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * `GET /api/search?q=&limit=` — 작품 + 장소 통합 검색. 로그인 불필요 (SecurityConfig 에서 permitAll).
 */
@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    @GetMapping
    public BaseResponse<SearchResponse> search(
            @RequestParam("q") String q,
            @RequestParam(value = "limit", required = false) Integer limit
    ) {
        return BaseResponse.success(searchService.search(q, limit));
    }
}
