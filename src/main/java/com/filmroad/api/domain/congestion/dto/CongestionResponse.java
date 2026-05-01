package com.filmroad.api.domain.congestion.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * PlaceDetailPage 의 혼잡도 섹션 응답.
 *
 * <p>{@code available=false} 일 때 프론트는 섹션 통째로 숨긴다 — 매핑 실패 / 외부 API
 * 실패 / 타임아웃 등으로 의미 있는 데이터를 못 받을 때. 200 응답은 항상 유지.</p>
 *
 * <p>{@code source} 는 사용자에게 표기할 데이터 출처 (예: "한국관광공사").</p>
 */
@Getter
@Builder
public class CongestionResponse {
    private boolean available;
    private String source;
    private List<CongestionItemDto> forecasts;
}
