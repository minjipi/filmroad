package com.filmroad.api.domain.route.dto;

import com.filmroad.api.domain.route.Route;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

import java.util.Date;
import java.util.List;

@Getter
@Builder
@Schema(description = "GET /api/route/{id} / POST 후속 응답 — 단건 코스 상세")
public class RouteResponse {

    private Long id;
    private String name;
    private String startTime;
    private Long contentId;
    private String contentTitle;
    private List<SavedRouteItemDto> items;
    private Date createdAt;
    private Date updatedAt;

    public static RouteResponse from(Route route) {
        return RouteResponse.builder()
                .id(route.getId())
                .name(route.getName())
                .startTime(route.getStartTime())
                .contentId(route.getContent() == null ? null : route.getContent().getId())
                .contentTitle(route.getContent() == null ? null : route.getContent().getTitle())
                .items(route.getPlaces().stream().map(SavedRouteItemDto::from).toList())
                .createdAt(route.getCreatedAt())
                .updatedAt(route.getUpdatedAt())
                .build();
    }
}
