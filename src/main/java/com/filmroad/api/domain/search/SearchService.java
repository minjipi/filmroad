package com.filmroad.api.domain.search;

import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceRepository;
import com.filmroad.api.domain.search.dto.PlaceSummaryDto;
import com.filmroad.api.domain.search.dto.SearchResponse;
import com.filmroad.api.domain.search.dto.WorkSummaryDto;
import com.filmroad.api.domain.work.Work;
import com.filmroad.api.domain.work.WorkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 작품(Work) + 장소(Place) 통합 검색. 섹션별로 별도 쿼리를 돌리고, 작품 섹션의 placeCount 는
 * 2차 집계 쿼리로 한 번에 채워 N+1 을 피한다.
 */
@Service
@RequiredArgsConstructor
public class SearchService {

    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 50;

    private final WorkRepository workRepository;
    private final PlaceRepository placeRepository;

    @Transactional(readOnly = true)
    public SearchResponse search(String q, Integer limit) {
        String normalized = q == null ? "" : q.trim();
        if (normalized.isEmpty()) {
            throw new BaseException(BaseResponseStatus.REQUEST_ERROR, "검색어를 입력해주세요.");
        }

        Pageable pageable = PageRequest.of(0, clampLimit(limit));

        List<Work> works = workRepository.searchByTitle(normalized, pageable);
        List<Place> places = placeRepository.searchByNameOrRegion(normalized, pageable);

        Map<Long, Integer> placeCountByWorkId = countPlacesPerWork(works);

        List<WorkSummaryDto> workDtos = works.stream()
                .map(w -> WorkSummaryDto.of(w, placeCountByWorkId.getOrDefault(w.getId(), 0)))
                .toList();
        List<PlaceSummaryDto> placeDtos = places.stream()
                .map(PlaceSummaryDto::of)
                .toList();

        return SearchResponse.builder()
                .query(normalized)
                .works(workDtos)
                .places(placeDtos)
                .build();
    }

    private Map<Long, Integer> countPlacesPerWork(List<Work> works) {
        if (works.isEmpty()) {
            return Map.of();
        }
        List<Long> workIds = works.stream().map(Work::getId).toList();
        Map<Long, Integer> counts = new HashMap<>();
        for (Object[] row : placeRepository.countByWorkIdIn(workIds)) {
            Long workId = ((Number) row[0]).longValue();
            int count = ((Number) row[1]).intValue();
            counts.put(workId, count);
        }
        return counts;
    }

    private static int clampLimit(Integer limit) {
        if (limit == null || limit <= 0) return DEFAULT_LIMIT;
        return Math.min(limit, MAX_LIMIT);
    }
}
