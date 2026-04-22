package com.filmroad.api.domain.map;

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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class MapControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("GET /api/map/places returns seeded markers with lat/lng and a non-null selected default")
    void getPlaces_noParams_returnsMarkers() throws Exception {
        mockMvc.perform(get("/api/map/places"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.code", is(20000)))
                .andExpect(jsonPath("$.results.markers", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.results.markers[0].latitude", notNullValue()))
                .andExpect(jsonPath("$.results.markers[0].longitude", notNullValue()))
                .andExpect(jsonPath("$.results.selected.id", notNullValue()));
    }

    @Test
    @DisplayName("GET /api/map/places?workId=1 filters markers to work 1 only")
    void getPlaces_byWorkId_filtersMarkers() throws Exception {
        mockMvc.perform(get("/api/map/places").param("workId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.markers", not(empty())))
                .andExpect(jsonPath("$.results.markers[*].workId", everyItem(is(1))));
    }

    @Test
    @DisplayName("GET /api/map/places?q=이태원 matches name/region/work title")
    void getPlaces_byQuery_filtersBySearchTerm() throws Exception {
        mockMvc.perform(get("/api/map/places").param("q", "이태원"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.markers", not(empty())))
                .andExpect(jsonPath("$.results.markers[*].workTitle",
                        everyItem(anyOf(containsString("이태원"), containsString("도깨비")))));
    }

    @Test
    @DisplayName("GET /api/map/places?lat=&lng=&selectedId= returns detail with distance for the chosen pin")
    void getPlaces_withSelectedId_returnsDetail() throws Exception {
        mockMvc.perform(get("/api/map/places")
                        .param("lat", "37.89")
                        .param("lng", "128.83")
                        .param("selectedId", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.selected.id", is(10)))
                .andExpect(jsonPath("$.results.selected.workId", is(1)))
                .andExpect(jsonPath("$.results.selected.photoCount", greaterThan(0)))
                .andExpect(jsonPath("$.results.selected.rating", greaterThan(0.0)))
                .andExpect(jsonPath("$.results.selected.distanceKm", lessThan(5.0)));
    }

    @Test
    @DisplayName("GET /api/map/places?q=no-such-term returns empty markers and null selected")
    void getPlaces_withNoMatches_returnsEmpty() throws Exception {
        mockMvc.perform(get("/api/map/places").param("q", "zzz-no-such-term-zzz"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.markers", hasSize(0)))
                .andExpect(jsonPath("$.results.selected").value(nullValue()));
    }
}
