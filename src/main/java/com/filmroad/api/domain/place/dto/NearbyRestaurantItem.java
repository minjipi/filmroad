package com.filmroad.api.domain.place.dto;

import com.filmroad.api.integration.koreatourism.KoreaTourismItem;
import lombok.Builder;
import lombok.Getter;

/**
 * `GET /api/places/{id}/nearby-restaurants` 응답 항목. 외부(한국관광공사) 의 raw 항목을
 * 프론트 친화 평탄 구조로 변환.
 *
 * <p>외부 명세의 mapX/mapY 는 longitude/latitude 의미라 도메인 응답에서는 lng/lat 으로 명확하게
 * 노출. 거리는 미터 단위 정수.</p>
 */
@Getter
@Builder
public class NearbyRestaurantItem {
    private String contentId;
    private String title;
    private String addr1;
    /** 거리 (m). 외부 API 의 dist 필드. null 가능. */
    private Integer distance;
    private String tel;
    /** 대표 이미지 URL — 외부 firstimage. 비어있는 경우 null. */
    private String imageUrl;
    private Double lat;
    private Double lng;

    public static NearbyRestaurantItem from(KoreaTourismItem raw) {
        return NearbyRestaurantItem.builder()
                .contentId(raw.contentId())
                .title(raw.title())
                .addr1(raw.addr1())
                .distance(raw.distance())
                .tel(raw.tel())
                .imageUrl(raw.imageUrl())
                .lat(raw.mapY())
                .lng(raw.mapX())
                .build();
    }
}
