package com.filmroad.api.domain.route.dto;

import com.filmroad.api.domain.route.Route;
import com.filmroad.api.domain.stamp.Stamp;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

import java.util.Date;
import java.util.List;
import java.util.Map;

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

    /**
     * @param route             route entity (places + content fetched)
     * @param stampByPlaceId    placeId → Stamp 매핑. 없는 place 는 visited=false 로 매핑.
     *                          owner-only 응답이므로 호출자(Service)가 owner 의 stamp 를 1쿼리로 모아 넘긴다.
     */
    public static RouteResponse from(Route route, Map<Long, Stamp> stampByPlaceId) {
        return RouteResponse.builder()
                .id(route.getId())
                .name(route.getName())
                .startTime(route.getStartTime())
                .contentId(route.getContent() == null ? null : route.getContent().getId())
                .contentTitle(route.getContent() == null ? null : route.getContent().getTitle())
                .items(route.getPlaces().stream()
                        .map(rp -> SavedRouteItemDto.from(rp, stampByPlaceId.get(rp.getPlace().getId())))
                        .toList())
                .createdAt(route.getCreatedAt())
                .updatedAt(route.getUpdatedAt())
                .build();
    }
}
