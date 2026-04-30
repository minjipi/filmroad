package com.filmroad.api.domain.route.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * `POST /api/route/directions` 응답.
 *
 * <p>외부 키 미설정/장애/빈 응답일 때도 200 + {@code available=false}, 빈 path 로 응답해
 * 프론트가 polyline 을 그리지 않고 자연스럽게 폴백할 수 있게 한다 (KakaoLocalClient
 * 정책과 동일).</p>
 */
@Getter
@Builder
@Schema(description = "카카오 모빌리티 directions 프록시 응답")
public class DirectionsResponse {

    @Schema(description = "외부 API 응답 가용 여부 (false 면 path/sections 비어있음)")
    private boolean available;

    @Schema(description = "위도/경도 폴리라인 정점 (출발→경유→도착 순) — sections 를 평탄화한 결과와 동일")
    private List<LatLngDto> path;

    @Schema(description = "leg(section) 별 폴리라인. leg 0 = origin→wp0, leg k = wp(k-1)→wp(k), 마지막 leg = 마지막 wp → destination. "
            + "프론트가 leg 별 시각 분리(예: perpendicular pixel offset)에 사용.")
    private List<List<LatLngDto>> sections;

    @Schema(description = "총 이동거리(미터)")
    private int distanceMeters;

    @Schema(description = "총 소요시간(초)")
    private int durationSec;

    public static DirectionsResponse unavailable() {
        return DirectionsResponse.builder()
                .available(false)
                .path(List.of())
                .sections(List.of())
                .distanceMeters(0)
                .durationSec(0)
                .build();
    }
}
