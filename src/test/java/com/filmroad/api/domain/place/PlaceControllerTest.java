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
                .andExpect(jsonPath("$.results.place.workEpisode", notNullValue()))
                .andExpect(jsonPath("$.results.place.sceneTimestamp", notNullValue()))
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
}
