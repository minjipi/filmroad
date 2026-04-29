package com.filmroad.api.domain.place;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for GET /api/places/{id}.
 *
 * Uses a real Spring context with an H2 in-memory DB (MySQL compat mode) so the
 * existing MariaDB-flavoured data.sql seed runs verbatim. No mocks below the
 * controller boundary.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class PlaceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("GET /api/places/10 returns full place detail with photos and related list")
    void getPlaceDetail_existingId_returnsFullPayload() throws Exception {
        mockMvc.perform(get("/api/places/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.code", is(20000)))
                .andExpect(jsonPath("$.results.place.id", is(10)))
                .andExpect(jsonPath("$.results.place.workId", is(1)))
                // 회차/타임스탬프는 평면 필드에서 빠지고 scenes[0] 안으로 이동.
                // place 10 은 시드에서 2개 씬을 받음(order=0/1) — 0번이 시즌1 1회 장면.
                .andExpect(jsonPath("$.results.place.scenes", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.results.place.scenes[0].workEpisode", notNullValue()))
                .andExpect(jsonPath("$.results.place.scenes[0].sceneTimestamp", notNullValue()))
                .andExpect(jsonPath("$.results.place.scenes[0].imageUrl", notNullValue()))
                .andExpect(jsonPath("$.results.place.scenes[0].orderIndex", is(0)))
                .andExpect(jsonPath("$.results.place.reviewCount", greaterThan(0)))
                // 좋아요(#46): place=10은 user=1 시드 place_like에 포함되어 liked=true.
                .andExpect(jsonPath("$.results.place.liked", is(true)))
                .andExpect(jsonPath("$.results.photos", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.results.photos", hasSize(lessThanOrEqualTo(6))))
                .andExpect(jsonPath("$.results.related", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.results.related[*].id", everyItem(not(is(10)))))
                .andExpect(jsonPath("$.results.related[*].workId", everyItem(is(1))));
    }

    @Test
    @DisplayName("GET /api/places/10?lat=&lng= computes distanceKm and driveTimeMin")
    void getPlaceDetail_withCoords_computesDistanceAndDriveTime() throws Exception {
        // (37.89, 128.83) is effectively on top of 주문진 영진해변 방파제 (id=10).
        mockMvc.perform(get("/api/places/10")
                        .param("lat", "37.89")
                        .param("lng", "128.83"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.place.distanceKm", lessThan(5.0)))
                .andExpect(jsonPath("$.results.place.driveTimeMin", notNullValue()));
    }

    @Test
    @DisplayName("GET /api/places/99999 (unknown id) returns 404 with PLACE_NOT_FOUND business code")
    void getPlaceDetail_unknownId_returnsNotFound() throws Exception {
        mockMvc.perform(get("/api/places/99999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(40050)));
    }

    @Test
    @DisplayName("GET /api/places/10/kakao-info: 키 비활성(test profile) + data.sql 캐시 → available=true 로 시드 데이터 반환")
    void getKakaoInfo_disabledKeyButCached_returnsCachedPayload() throws Exception {
        // application-test.yml 의 kakao.rest-api-key=disabled-kakao 이지만 data.sql 의
        // kakao_place_info 시드 행(place_id=10) 이 24h 내 lastSyncedAt 으로 박혀 있어
        // 외부 호출 없이 캐시된 값으로 응답한다.
        mockMvc.perform(get("/api/places/10/kakao-info"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.available", is(true)))
                .andExpect(jsonPath("$.results.roadAddress", containsString("주문진")))
                .andExpect(jsonPath("$.results.kakaoPlaceUrl", startsWith("https://place.map.kakao.com")))
                // 키 비활성이라 nearby 외부 호출은 빈 결과 반환.
                .andExpect(jsonPath("$.results.nearby", hasSize(0)));
    }

    @Test
    @DisplayName("GET /api/places/12/kakao-info: 시드 캐시 없음 + 키 비활성 → available=false 로 200 응답")
    void getKakaoInfo_noCacheAndDisabledKey_returnsUnavailable() throws Exception {
        // place_id=12 에는 data.sql kakao_place_info 시드 행이 없음. 키도 비활성이라
        // 외부 호출도 빈 결과 → available=false 로 떨어져야 함 (404 X).
        mockMvc.perform(get("/api/places/12/kakao-info"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.available", is(false)))
                .andExpect(jsonPath("$.results.nearby", hasSize(0)));
    }

    @Test
    @DisplayName("GET /api/places/99999/kakao-info: 존재하지 않는 placeId → 404 PLACE_NOT_FOUND")
    void getKakaoInfo_unknownId_returnsNotFound() throws Exception {
        mockMvc.perform(get("/api/places/99999/kakao-info"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(40050)));
    }

    @Test
    @DisplayName("GET /api/places/10/nearby-restaurants: 외부 API 키 비활성(test profile) → 200 + items=[] (섹션 빈 표시)")
    void getNearbyRestaurants_disabledKey_returnsEmptyItems() throws Exception {
        // application-test.yml 의 korea-tourism.service-key=disabled-korea-tourism 이라
        // KoreaTourismClient 가 외부 호출 없이 빈 리스트 반환 → 응답은 200 + items=[].
        mockMvc.perform(get("/api/places/10/nearby-restaurants"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.code", is(20000)))
                .andExpect(jsonPath("$.results.items", hasSize(0)));
    }

    @Test
    @DisplayName("GET /api/places/99999/nearby-restaurants: 존재하지 않는 placeId → 404 PLACE_NOT_FOUND")
    void getNearbyRestaurants_unknownId_returnsNotFound() throws Exception {
        mockMvc.perform(get("/api/places/99999/nearby-restaurants"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(40050)));
    }
}
