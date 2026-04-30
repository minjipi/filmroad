package com.filmroad.api.domain.route.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
@Schema(description = "GET /api/route/init 응답")
public class RouteInitResponse {

    @Schema(description = "기준 콘텐츠")
    private RouteInitContentDto content;

    @Schema(description = "추천 코스명 — 보통 \"{title} 코스\"")
    private String suggestedName;

    @Schema(description = "추천 출발 시각 (HH:mm)")
    private String suggestedStartTime;

    @Schema(description = "콘텐츠 소속 장소들 (Place.id ASC, durationMin 기본 60)")
    private List<RouteInitPlaceDto> places;
}
