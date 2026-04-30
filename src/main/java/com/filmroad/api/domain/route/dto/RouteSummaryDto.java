package com.filmroad.api.domain.route.dto;

import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.route.Route;
import com.filmroad.api.domain.route.RoutePlace;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

import java.util.Date;
import java.util.List;

@Getter
@Builder
@Schema(description = "GET /api/route/me 카드용 요약")
public class RouteSummaryDto {

    private Long id;
    private String name;
    private Long contentId;
    private String contentTitle;
    private int placeCount;
    private Date updatedAt;
    private String coverImageUrl;

    public static RouteSummaryDto from(Route route) {
        List<RoutePlace> places = route.getPlaces();
        Place firstPlace = places.isEmpty() ? null : places.get(0).getPlace();
        return RouteSummaryDto.builder()
                .id(route.getId())
                .name(route.getName())
                .contentId(route.getContent() == null ? null : route.getContent().getId())
                .contentTitle(route.getContent() == null ? null : route.getContent().getTitle())
                .placeCount(places.size())
                .updatedAt(route.getUpdatedAt())
                .coverImageUrl(firstPlace == null ? null : firstPlace.getPrimaryCoverImageUrl())
                .build();
    }
}
