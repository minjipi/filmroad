package com.filmroad.api.domain.place.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * `GET /api/places/{id}/nearby-restaurants` 응답. 외부 API(한국관광공사) 가 키 미설정/장애여도
 * 200 + 빈 리스트로 응답해 프론트가 섹션을 자연스럽게 처리할 수 있게 함.
 *
 * @param items 정제된 음식점 리스트. 비어있어도 null 이 아닌 빈 List.
 */
@Getter
@Builder
public class NearbyRestaurantsResponse {
    private List<NearbyRestaurantItem> items;

    public static NearbyRestaurantsResponse empty() {
        return NearbyRestaurantsResponse.builder()
                .items(List.of())
                .build();
    }

    public static NearbyRestaurantsResponse of(List<NearbyRestaurantItem> items) {
        return NearbyRestaurantsResponse.builder()
                .items(items == null ? List.of() : items)
                .build();
    }
}
