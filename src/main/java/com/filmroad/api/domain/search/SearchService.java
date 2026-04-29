package com.filmroad.api.domain.search;

import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceRepository;
import com.filmroad.api.domain.search.dto.PlaceSummaryDto;
import com.filmroad.api.domain.search.dto.SearchResponse;
import com.filmroad.api.domain.search.dto.ContentSummaryDto;
import com.filmroad.api.domain.content.Content;
import com.filmroad.api.domain.content.ContentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 작품(Content) + 장소(Place) 통합 검색. 섹션별로 별도 쿼리를 돌리고, 작품 섹션의 placeCount 는
 * 2차 집계 쿼리로 한 번에 채워 N+1 을 피한다.
 */
@Service
@RequiredArgsConstructor
public class SearchService {

    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 50;

    private final ContentRepository contentRepository;
    private final PlaceRepository placeRepository;

    @Transactional(readOnly = true)
    public SearchResponse search(String q, Integer limit) {
        String normalized = q == null ? "" : q.trim();
        if (normalized.isEmpty()) {
            throw new BaseException(BaseResponseStatus.REQUEST_ERROR, "검색어를 입력해주세요.");
        }

        Pageable pageable = PageRequest.of(0, clampLimit(limit));

        List<Content> contents = contentRepository.searchByTitle(normalized, pageable);
        List<Place> places = placeRepository.searchByNameOrRegion(normalized, pageable);

        Map<Long, Integer> placeCountByContentId = countPlacesPerContent(contents);

        List<ContentSummaryDto> workDtos = contents.stream()
                .map(w -> ContentSummaryDto.of(w, placeCountByContentId.getOrDefault(w.getId(), 0)))
                .toList();
        List<PlaceSummaryDto> placeDtos = places.stream()
                .map(PlaceSummaryDto::of)
                .toList();

        return SearchResponse.builder()
                .query(normalized)
                .contents(workDtos)
                .places(placeDtos)
                .build();
    }

    private Map<Long, Integer> countPlacesPerContent(List<Content> contents) {
        if (contents.isEmpty()) {
            return Map.of();
        }
        List<Long> contentIds = contents.stream().map(Content::getId).toList();
        Map<Long, Integer> counts = new HashMap<>();
        for (Object[] row : placeRepository.countByContentIdIn(contentIds)) {
            Long contentId = ((Number) row[0]).longValue();
            int count = ((Number) row[1]).intValue();
            counts.put(contentId, count);
        }
        return counts;
    }

    private static int clampLimit(Integer limit) {
        if (limit == null || limit <= 0) return DEFAULT_LIMIT;
        return Math.min(limit, MAX_LIMIT);
    }
}
