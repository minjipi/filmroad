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
                .andExpect(jsonPath("$.results.hero.workId", notNullValue()))
                // 좋아요(#46): place=10은 user=1 시드 place_like에 포함되어 liked=true.
                .andExpect(jsonPath("$.results.places[?(@.id == 10)].liked", contains(true)));
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
    @DisplayName("GET /api/home?scope=NEAR with tight radius filters far places out")
    void getHome_nearScope_withTightRadius_filtersFarPlaces() throws Exception {
        // 강릉 주문진 영진해변(id=10) 좌표에서 반경 0.1km 안엔 자기 자신 한 곳 정도만
        // 남는 게 맞다. 서울/부산 시드 장소는 모두 걸러져야 함.
        mockMvc.perform(get("/api/home")
                        .param("lat", "37.8928")
                        .param("lng", "128.8347")
                        .param("radiusKm", "0.1")
                        .param("scope", "NEAR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.places", hasSize(lessThanOrEqualTo(3))))
                .andExpect(jsonPath("$.results.places[?(@.id == 10)]", hasSize(1)));
    }

    @Test
    @DisplayName("GET /api/home?scope=NEAR with huge radius returns full seed list sorted by distance")
    void getHome_nearScope_withHugeRadius_returnsAll() throws Exception {
        // 반경 5000km 이면 한국 전체는 물론이고 시드 장소 전부가 포함된다.
        // 이전 동작(radius 없이 전국 정렬)과 동일한 결과가 나와야 함.
        mockMvc.perform(get("/api/home")
                        .param("lat", "37.5665")
                        .param("lng", "126.9780")
                        .param("radiusKm", "5000")
                        .param("scope", "NEAR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.places", hasSize(greaterThanOrEqualTo(4))));
    }

    @Test
    @DisplayName("GET /api/home?scope=NEAR with radius far from any seed returns empty places")
    void getHome_nearScope_farFromSeeds_returnsEmpty() throws Exception {
        // 태평양 한가운데 좌표 + 기본 반경 → 근처 시드 0 개. places 는 빈 리스트,
        // 그 외 응답 구조(works, hero) 는 유지.
        mockMvc.perform(get("/api/home")
                        .param("lat", "0")
                        .param("lng", "-160")
                        .param("radiusKm", "30")
                        .param("scope", "NEAR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.places", hasSize(0)))
                .andExpect(jsonPath("$.results.works", hasSize(greaterThanOrEqualTo(4))))
                .andExpect(jsonPath("$.results.hero.title", notNullValue()));
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

    @Test
    @DisplayName("Hero subtitle: lat/lng 제공 시 실제 거리 ('내 위치에서 약 …') 로 채워짐")
    void getHome_heroSubtitle_includesActualDistance_whenCoordsProvided() throws Exception {
        // 주문진 영진해변(id=10) 좌표에서 시작 — 가장 가까운 시드 위에서.
        mockMvc.perform(get("/api/home")
                        .param("lat", "37.8928")
                        .param("lng", "128.8347")
                        .param("scope", "NEAR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.hero.subtitle", containsString("내 위치에서 약")))
                // "차로 12분" 같은 하드코딩 카피가 더 이상 등장하면 안 됨.
                .andExpect(jsonPath("$.results.hero.subtitle", not(containsString("차로 12분"))));
    }

    @Test
    @DisplayName("Hero subtitle: lat/lng 미제공 시 거리 대신 중립 카피 ('주변 N곳의 성지')")
    void getHome_heroSubtitle_neutralCopy_whenNoCoords() throws Exception {
        // 좌표 없이 호출 — 폴백 센터로 "약 12km" 같은 거짓 거리 카피를 만들면 안 됨.
        mockMvc.perform(get("/api/home"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.hero.subtitle", not(containsString("내 위치에서"))))
                .andExpect(jsonPath("$.results.hero.subtitle", not(containsString("차로 12분"))))
                .andExpect(jsonPath("$.results.hero.subtitle", containsString("성지")));
    }

    @Test
    @DisplayName("GET /api/home → popularWorks 는 place trendingScore 합 DESC 정렬")
    void getHome_popularWorks_orderedByAggregatedTrendingScore() throws Exception {
        // 시드 기준 작품별 trendingScore 합:
        //   도깨비(1)=98+80=178, 이태원 클라쓰(2)=90+70=160,
        //   호텔 델루나(3)=84+75=159, 미스터션샤인(4)=92+65=157
        // 따라서 popularWorks[0] = work id=1, trendingScore=178, placeCount=2.
        mockMvc.perform(get("/api/home"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.popularWorks", hasSize(greaterThanOrEqualTo(4))))
                .andExpect(jsonPath("$.results.popularWorks[0].id", is(1)))
                .andExpect(jsonPath("$.results.popularWorks[0].title", is("도깨비")))
                .andExpect(jsonPath("$.results.popularWorks[0].type", is("DRAMA")))
                .andExpect(jsonPath("$.results.popularWorks[0].placeCount", is(2)))
                .andExpect(jsonPath("$.results.popularWorks[0].trendingScore", is(178)))
                // 두 번째는 이태원 클라쓰(160), 세 번째는 호텔 델루나(159).
                .andExpect(jsonPath("$.results.popularWorks[1].id", is(2)))
                .andExpect(jsonPath("$.results.popularWorks[1].trendingScore", is(160)))
                .andExpect(jsonPath("$.results.popularWorks[2].id", is(3)))
                .andExpect(jsonPath("$.results.popularWorks[2].trendingScore", is(159)))
                // 기존 works[] 는 filter chip 용이라 경량 shape (id/title) 유지.
                .andExpect(jsonPath("$.results.works[0].id", notNullValue()))
                .andExpect(jsonPath("$.results.works[0].title", notNullValue()));
    }
}
