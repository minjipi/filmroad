package com.filmroad.api.domain.route.dto;

import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.route.RoutePlace;
import com.filmroad.api.domain.stamp.Stamp;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

import java.util.Date;

@Getter
@Builder
@Schema(description = "Route 응답 항목 — Place 메타 + 사용자 입력(orderIndex/durationMin/note) + 인증샷 보유 플래그")
public class SavedRouteItemDto {

    private Long placeId;
    private String name;
    private String regionLabel;
    private String address;
    private Double latitude;
    private Double longitude;
    private String coverImageUrl;
    private String sceneImageUrl;
    private int orderIndex;
    private int durationMin;
    private String note;
    private double rating;

    @Schema(description = "코스 소유자가 해당 place 에 인증샷(Stamp) 을 보유하면 true.")
    private boolean visited;

    @Schema(description = "visited=true 일 때 stamp 획득 시각, 아니면 null.")
    private Date visitedAt;

    public static SavedRouteItemDto from(RoutePlace rp, Stamp stamp) {
        Place p = rp.getPlace();
        return SavedRouteItemDto.builder()
                .placeId(p.getId())
                .name(p.getName())
                .regionLabel(p.getRegionLabel())
                .address(p.getAddress())
                .latitude(p.getLatitude())
                .longitude(p.getLongitude())
                .coverImageUrl(p.getPrimaryCoverImageUrl())
                .sceneImageUrl(p.getPrimarySceneImageUrl())
                .orderIndex(rp.getOrderIndex())
                .durationMin(rp.getDurationMin())
                .note(rp.getNote())
                .rating(p.getRating())
                .visited(stamp != null)
                .visitedAt(stamp == null ? null : stamp.getAcquiredAt())
                .build();
    }
}
