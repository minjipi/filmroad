package com.filmroad.api.domain.home;

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
 * Integration tests for the /api/home endpoint.
 *
 * Uses a real Spring context with an H2 in-memory DB (MySQL compat mode) so the
 * existing MariaDB-flavoured data.sql seed runs verbatim. No mocks below the
 * controller boundary.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class HomeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("GET /api/home (no params) returns seeded works + places with hero")
    void getHome_noParams_returnsSeedData() throws Exception {
        mockMvc.perform(get("/api/home"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.code", is(20000)))
                .andExpect(jsonPath("$.results.works", hasSize(greaterThanOrEqualTo(4))))
                .andExpect(jsonPath("$.results.places", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.results.places", hasSize(lessThanOrEqualTo(20))))
                .andExpect(jsonPath("$.results.hero.workId", notNullValue()));
    }

    @Test
    @DisplayName("GET /api/home?workId=1 filters places to work 1 only")
    void getHome_byWorkId_filtersPlaces() throws Exception {
        mockMvc.perform(get("/api/home").param("workId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.places", not(empty())))
                .andExpect(jsonPath("$.results.places[*].workId", everyItem(is(1))));
    }

    @Test
    @DisplayName("GET /api/home?lat=&lng=&scope=NEAR sorts by proximity")
    void getHome_nearScope_sortsByProximity() throws Exception {
        // (37.89, 128.83) is effectively on top of 주문진 영진해변 방파제 (id=10).
        mockMvc.perform(get("/api/home")
                        .param("lat", "37.89")
                        .param("lng", "128.83")
                        .param("scope", "NEAR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.places", not(empty())))
                .andExpect(jsonPath("$.results.places[0].regionLabel",
                        anyOf(containsString("강릉"), containsString("주문진"))));
    }

    @Test
    @DisplayName("GET /api/home?scope=TRENDING returns places with the top trending seed first")
    void getHome_trendingScope_ordersByTrendingScore() throws Exception {
        // trendingScore is not exposed on PlaceSummaryDto. We fall back to asserting
        // that the first place matches the seed with the highest score (id=10, score=98).
        mockMvc.perform(get("/api/home").param("scope", "TRENDING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.places", not(empty())))
                .andExpect(jsonPath("$.results.places[0].id", is(10)));
    }

    @Test
    @DisplayName("GET /api/home?scope=NEAR without lat/lng falls back to default center (non-empty places)")
    void getHome_nearScope_withoutCoords_usesDefaultCenter() throws Exception {
        // Regression: previously, scope=NEAR + missing coords silently routed to
        // TRENDING. Now the server must apply a default center and still return
        // a proximity-ordered list of seeded places.
        mockMvc.perform(get("/api/home").param("scope", "NEAR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.places", not(empty())))
                .andExpect(jsonPath("$.results.places[0].id", is(10)));
    }

    @Test
    @DisplayName("GET /api/home?workId=9999 (unknown work) returns empty places but still lists works")
    void getHome_unknownWorkId_returnsEmptyPlacesButKeepsWorks() throws Exception {
        mockMvc.perform(get("/api/home").param("workId", "9999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.places", hasSize(0)))
                .andExpect(jsonPath("$.results.works", hasSize(greaterThanOrEqualTo(4))));
    }
}
