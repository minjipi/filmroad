package com.filmroad.api.domain.route;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.filmroad.api.domain.auth.JwtTokenService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration tests for the Route CRUD endpoints (task #10).
 *
 * <p>Directions endpoint(task #8) 은 별도 {@link RouteControllerTest} 에서 다룬다.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class RouteCrudControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtTokenService jwtTokenService;

    private Cookie cookieFor(long userId) {
        return new Cookie("ATOKEN", jwtTokenService.issueAccess(userId));
    }

    /* --------------------------------- init --------------------------------- */

    @Test
    @DisplayName("GET /api/route/init: 비로그인 OK + 콘텐츠 + 추천 장소 + 09:00")
    void init_anonymous_ok() throws Exception {
        // 시드: content_id=1 ('도깨비') + place 들 (10, 14 등 — data.sql 참조).
        mockMvc.perform(get("/api/route/init").param("contentId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.content.id", is(1)))
                .andExpect(jsonPath("$.results.content.title", notNullValue()))
                .andExpect(jsonPath("$.results.suggestedStartTime", is("09:00")))
                .andExpect(jsonPath("$.results.suggestedName", notNullValue()))
                .andExpect(jsonPath("$.results.places", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.results.places[*].durationMin", everyItem(is(60))));
    }

    @Test
    @DisplayName("GET /api/route/init: 미존재 contentId → 404")
    void init_unknownContent_returns404() throws Exception {
        mockMvc.perform(get("/api/route/init").param("contentId", "99999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is(40051)));
    }

    /* --------------------------------- save --------------------------------- */

    @Test
    @DisplayName("POST /api/route: 미인증 → 401")
    void create_anonymous_returns401() throws Exception {
        Map<String, Object> body = Map.of(
                "name", "test",
                "startTime", "09:00",
                "items", List.of(Map.of("placeId", 10, "orderIndex", 0, "durationMin", 60))
        );
        mockMvc.perform(post("/api/route")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/route: happy → id 반환, GET 으로 본인 조회 200")
    void create_happy_returnsIdAndOwnerCanGet() throws Exception {
        Map<String, Object> body = Map.of(
                "name", "도깨비 추억 코스",
                "startTime", "09:30",
                "contentId", 1,
                "items", List.of(
                        Map.of("placeId", 10, "orderIndex", 0, "durationMin", 60, "note", "방파제 인생샷"),
                        Map.of("placeId", 14, "orderIndex", 1, "durationMin", 90)
                )
        );
        MvcResult res = mockMvc.perform(post("/api/route")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body))
                        .cookie(cookieFor(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.id", notNullValue()))
                .andReturn();

        Number id = objectMapper.readTree(res.getResponse().getContentAsString())
                .at("/results/id").numberValue();

        mockMvc.perform(get("/api/route/" + id).cookie(cookieFor(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.name", is("도깨비 추억 코스")))
                .andExpect(jsonPath("$.results.startTime", is("09:30")))
                .andExpect(jsonPath("$.results.contentId", is(1)))
                .andExpect(jsonPath("$.results.contentTitle", notNullValue()))
                .andExpect(jsonPath("$.results.items", hasSize(2)))
                .andExpect(jsonPath("$.results.items[0].orderIndex", is(0)))
                .andExpect(jsonPath("$.results.items[0].placeId", is(10)))
                .andExpect(jsonPath("$.results.items[0].note", is("방파제 인생샷")))
                .andExpect(jsonPath("$.results.items[1].durationMin", is(90)));
    }

    @Test
    @DisplayName("POST /api/route: items 비어있으면 → 400")
    void create_emptyItems_returns400() throws Exception {
        Map<String, Object> body = Map.of(
                "name", "x",
                "startTime", "09:00",
                "items", List.of()
        );
        mockMvc.perform(post("/api/route")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body))
                        .cookie(cookieFor(1L)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/route: startTime 형식 위반 (\"9:00\") → 400")
    void create_invalidStartTime_returns400() throws Exception {
        Map<String, Object> body = Map.of(
                "name", "x",
                "startTime", "9:00",
                "items", List.of(Map.of("placeId", 10, "orderIndex", 0, "durationMin", 60))
        );
        mockMvc.perform(post("/api/route")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body))
                        .cookie(cookieFor(1L)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/route: orderIndex 비연속 → 400 ROUTE_INVALID_ITEMS")
    void create_nonContiguousOrderIndex_returns400() throws Exception {
        Map<String, Object> body = Map.of(
                "name", "bad",
                "startTime", "09:00",
                "items", List.of(
                        Map.of("placeId", 10, "orderIndex", 0, "durationMin", 60),
                        Map.of("placeId", 14, "orderIndex", 5, "durationMin", 60)
                )
        );
        mockMvc.perform(post("/api/route")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body))
                        .cookie(cookieFor(1L)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is(30100)));
    }

    /* --------------------------------- read --------------------------------- */

    @Test
    @DisplayName("GET /api/route/{id}: 타 유저 접근 → 403 ROUTE_FORBIDDEN")
    void getRoute_nonOwner_returns403() throws Exception {
        Map<String, Object> body = Map.of(
                "name", "user1 코스",
                "startTime", "09:00",
                "items", List.of(Map.of("placeId", 10, "orderIndex", 0, "durationMin", 60))
        );
        MvcResult res = mockMvc.perform(post("/api/route")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body))
                        .cookie(cookieFor(1L)))
                .andExpect(status().isOk())
                .andReturn();
        Number id = objectMapper.readTree(res.getResponse().getContentAsString())
                .at("/results/id").numberValue();

        // user 2 가 user 1 코스 조회 시도.
        mockMvc.perform(get("/api/route/" + id).cookie(cookieFor(2L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code", is(40101)));
    }

    @Test
    @DisplayName("GET /api/route/{id}: 미존재 → 404 ROUTE_NOT_FOUND")
    void getRoute_unknown_returns404() throws Exception {
        mockMvc.perform(get("/api/route/99999").cookie(cookieFor(1L)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is(40100)));
    }

    @Test
    @DisplayName("GET /api/route/me: 내 코스 목록")
    void listMyRoutes_returnsList() throws Exception {
        mockMvc.perform(post("/api/route")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "A",
                                "startTime", "09:00",
                                "items", List.of(Map.of("placeId", 10, "orderIndex", 0, "durationMin", 60))
                        )))
                        .cookie(cookieFor(1L)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/route/me").cookie(cookieFor(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.results[0].id", notNullValue()))
                .andExpect(jsonPath("$.results[0].placeCount", greaterThanOrEqualTo(1)));
    }

    /* --------------------------------- update --------------------------------- */

    @Test
    @DisplayName("PUT /api/route/{id}: 본인 → items 통째 교체")
    void updateRoute_owner_replacesItems() throws Exception {
        MvcResult create = mockMvc.perform(post("/api/route")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "old",
                                "startTime", "08:00",
                                "items", List.of(Map.of("placeId", 10, "orderIndex", 0, "durationMin", 60))
                        )))
                        .cookie(cookieFor(1L)))
                .andExpect(status().isOk())
                .andReturn();
        Number id = objectMapper.readTree(create.getResponse().getContentAsString())
                .at("/results/id").numberValue();

        mockMvc.perform(put("/api/route/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "new",
                                "startTime", "11:00",
                                "items", List.of(
                                        Map.of("placeId", 14, "orderIndex", 0, "durationMin", 30),
                                        Map.of("placeId", 10, "orderIndex", 1, "durationMin", 45)
                                )
                        )))
                        .cookie(cookieFor(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.name", is("new")))
                .andExpect(jsonPath("$.results.startTime", is("11:00")))
                .andExpect(jsonPath("$.results.items", hasSize(2)))
                .andExpect(jsonPath("$.results.items[0].placeId", is(14)))
                .andExpect(jsonPath("$.results.items[0].durationMin", is(30)));
    }

    @Test
    @DisplayName("PUT /api/route/{id}: 타 유저 → 403")
    void updateRoute_nonOwner_returns403() throws Exception {
        MvcResult create = mockMvc.perform(post("/api/route")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "user1",
                                "startTime", "09:00",
                                "items", List.of(Map.of("placeId", 10, "orderIndex", 0, "durationMin", 60))
                        )))
                        .cookie(cookieFor(1L)))
                .andExpect(status().isOk())
                .andReturn();
        Number id = objectMapper.readTree(create.getResponse().getContentAsString())
                .at("/results/id").numberValue();

        mockMvc.perform(put("/api/route/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "evil",
                                "startTime", "09:00",
                                "items", List.of(Map.of("placeId", 10, "orderIndex", 0, "durationMin", 60))
                        )))
                        .cookie(cookieFor(2L)))
                .andExpect(status().isForbidden());
    }

    /* --------------------------------- delete --------------------------------- */

    @Test
    @DisplayName("DELETE /api/route/{id}: 본인 → 삭제 후 GET 404")
    void deleteRoute_owner_returnsAndThenNotFound() throws Exception {
        MvcResult create = mockMvc.perform(post("/api/route")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "to-delete",
                                "startTime", "09:00",
                                "items", List.of(Map.of("placeId", 10, "orderIndex", 0, "durationMin", 60))
                        )))
                        .cookie(cookieFor(1L)))
                .andExpect(status().isOk())
                .andReturn();
        Number id = objectMapper.readTree(create.getResponse().getContentAsString())
                .at("/results/id").numberValue();

        mockMvc.perform(delete("/api/route/" + id).cookie(cookieFor(1L)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/route/" + id).cookie(cookieFor(1L)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("DELETE /api/route/{id}: 타 유저 → 403, 코스 그대로 살아있음")
    void deleteRoute_nonOwner_returns403AndKeepsRoute() throws Exception {
        MvcResult create = mockMvc.perform(post("/api/route")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "keep",
                                "startTime", "09:00",
                                "items", List.of(Map.of("placeId", 10, "orderIndex", 0, "durationMin", 60))
                        )))
                        .cookie(cookieFor(1L)))
                .andExpect(status().isOk())
                .andReturn();
        Number id = objectMapper.readTree(create.getResponse().getContentAsString())
                .at("/results/id").numberValue();

        mockMvc.perform(delete("/api/route/" + id).cookie(cookieFor(2L)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/route/" + id).cookie(cookieFor(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.id", is(id.intValue())));
    }
}
