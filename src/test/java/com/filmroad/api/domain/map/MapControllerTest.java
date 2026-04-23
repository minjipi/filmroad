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

    @Test
    @DisplayName("GET /api/map/places with Seoul bbox keeps markers inside the box only")
    void getPlaces_withBounds_filtersToViewport() throws Exception {
        // 시드상 서울 근방(위도 37.4~37.7, 경도 126.9~127.1): place 13(이태원), 14(덕수궁), 16(녹사평).
        // 강릉(10)·논산(11)·포항(12,15)·합천(17) 은 바깥이어야 한다.
        mockMvc.perform(get("/api/map/places")
                        .param("swLat", "37.4")
                        .param("swLng", "126.9")
                        .param("neLat", "37.7")
                        .param("neLng", "127.1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.markers", not(empty())))
                .andExpect(jsonPath("$.results.markers[*].id",
                        everyItem(anyOf(is(13), is(14), is(16)))))
                .andExpect(jsonPath("$.results.markers[*].id",
                        not(hasItem(is(10)))));
    }

    @Test
    @DisplayName("GET /api/map/places with bounds + selectedId outside bbox still returns selected via fallback")
    void getPlaces_withBoundsAndDeepLinkedSelected_returnsSelectedDetail() throws Exception {
        // 서울 bbox 를 주되 강릉(10) 을 selectedId 로 지정 → markers 에는 없어도 selected 는 내려가야 함.
        mockMvc.perform(get("/api/map/places")
                        .param("swLat", "37.4")
                        .param("swLng", "126.9")
                        .param("neLat", "37.7")
                        .param("neLng", "127.1")
                        .param("selectedId", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.selected.id", is(10)))
                .andExpect(jsonPath("$.results.markers[*].id", not(hasItem(is(10)))));
    }

    @Test
    @DisplayName("GET /api/map/places with malformed bounds (sw > ne) returns 400 REQUEST_ERROR")
    void getPlaces_withSwappedBounds_returns400() throws Exception {
        mockMvc.perform(get("/api/map/places")
                        .param("swLat", "37.9")
                        .param("swLng", "127.2")
                        .param("neLat", "37.5")
                        .param("neLng", "126.9"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is(30001)));
    }

    @Test
    @DisplayName("GET /api/map/places with partial bounds params is ignored (전국 반환)")
    void getPlaces_withPartialBounds_ignoresFilter() throws Exception {
        // swLat 만 넘겨도 필터가 활성화되지 않아야 함. markers 는 시드 전체가 내려와야.
        mockMvc.perform(get("/api/map/places").param("swLat", "37.4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.markers[*].id", hasItem(is(10))))
                .andExpect(jsonPath("$.results.markers[*].id", hasItem(is(17))));
    }
}
