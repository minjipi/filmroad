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
    /** 거리 (m). 외부 API 의 dist 필드. null 가능. 필드명에 단위(M) 명시. */
    private Integer distanceM;
    private String tel;
    /** 대표 이미지 URL — 외부 firstimage. 비어있는 경우 null. */
    private String imageUrl;
    private Double latitude;
    private Double longitude;
    /**
     * 카테고리 한글 라벨 (예: "한식 > 해물,생선"). 현재 백엔드는 항상 null —
     * TourAPI `locationBasedList2` 응답이 cat1/cat2/cat3 코드만 주고 한글 라벨은
     * 별도 매핑 데이터(`categoryCode2` API) 가 필요. 후속 task 에서 매핑 lookup 추가
     * 시 본 필드만 채워주면 contract 변경 없음. 프론트는 nullable 로 받아 표시 생략 가능.
     */
    private String categoryName;

    public static NearbyRestaurantItem from(KoreaTourismItem raw) {
        return NearbyRestaurantItem.builder()
                .contentId(raw.contentId())
                .title(raw.title())
                .addr1(raw.addr1())
                .distanceM(raw.distance())
                .tel(raw.tel())
                .imageUrl(raw.imageUrl())
                .latitude(raw.mapY())
                .longitude(raw.mapX())
                .categoryName(null)  // TourAPI cat3 매핑 데이터 도입 시 실제 라벨 세팅
                .build();
    }
}
