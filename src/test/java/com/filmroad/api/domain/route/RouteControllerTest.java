package com.filmroad.api.domain.route;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.filmroad.api.integration.kakao.KakaoMobilityClient;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration tests for POST /api/route/directions.
 *
 * KakaoMobilityClient 만 mock — 컨트롤러 → 서비스 → DTO 변환 + Bean Validation 은
 * 실제 코드 그대로 실행.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RouteControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private KakaoMobilityClient kakaoMobilityClient;

    @Test
    @DisplayName("happy path: KakaoMobilityClient 가 경로 반환 → available=true + path/sections/distance/duration")
    void getDirections_happyPath_returnsRoute() throws Exception {
        // 2개 leg: origin → wp → destination. sections 별로 따로 노출.
        KakaoMobilityClient.LatLng a = new KakaoMobilityClient.LatLng(37.57, 126.98);
        KakaoMobilityClient.LatLng b = new KakaoMobilityClient.LatLng(37.575, 126.985);
        KakaoMobilityClient.LatLng c = new KakaoMobilityClient.LatLng(37.58, 126.99);
        when(kakaoMobilityClient.getDirections(any(), any(), anyList()))
                .thenReturn(Optional.of(new KakaoMobilityClient.MobilityRoute(
                        List.of(a, b, c),
                        List.of(List.of(a, b), List.of(b, c)),
                        12345,
                        678
                )));

        Map<String, Object> body = Map.of(
                "origin", Map.of("lat", 37.57, "lng", 126.98),
                "destination", Map.of("lat", 37.58, "lng", 126.99),
                "waypoints", List.of(Map.of("lat", 37.575, "lng", 126.985))
        );

        mockMvc.perform(post("/api/route/directions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.available", is(true)))
                .andExpect(jsonPath("$.results.path.length()", is(3)))
                .andExpect(jsonPath("$.results.path[0].lat", is(37.57)))
                .andExpect(jsonPath("$.results.path[0].lng", is(126.98)))
                .andExpect(jsonPath("$.results.sections.length()", is(2)))
                .andExpect(jsonPath("$.results.sections[0].length()", is(2)))
                .andExpect(jsonPath("$.results.sections[1].length()", is(2)))
                .andExpect(jsonPath("$.results.sections[0][0].lat", is(37.57)))
                .andExpect(jsonPath("$.results.sections[1][1].lat", is(37.58)))
                .andExpect(jsonPath("$.results.distanceMeters", is(12345)))
                .andExpect(jsonPath("$.results.durationSec", is(678)));
    }

    @Test
    @DisplayName("client empty → available=false, path 빈 리스트")
    void getDirections_clientEmpty_returnsUnavailable() throws Exception {
        when(kakaoMobilityClient.getDirections(any(), any(), anyList()))
                .thenReturn(Optional.empty());

        Map<String, Object> body = Map.of(
                "origin", Map.of("lat", 37.57, "lng", 126.98),
                "destination", Map.of("lat", 37.58, "lng", 126.99)
        );

        mockMvc.perform(post("/api/route/directions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.available", is(false)))
                .andExpect(jsonPath("$.results.path.length()", is(0)))
                .andExpect(jsonPath("$.results.sections.length()", is(0)))
                .andExpect(jsonPath("$.results.distanceMeters", is(0)))
                .andExpect(jsonPath("$.results.durationSec", is(0)));
    }

    @Test
    @DisplayName("waypoints 생략 OK — 빈 리스트로 정규화돼 클라이언트 호출")
    void getDirections_waypointsOmitted_isOk() throws Exception {
        when(kakaoMobilityClient.getDirections(any(), any(), anyList()))
                .thenReturn(Optional.empty());

        Map<String, Object> body = Map.of(
                "origin", Map.of("lat", 37.57, "lng", 126.98),
                "destination", Map.of("lat", 37.58, "lng", 126.99)
        );

        mockMvc.perform(post("/api/route/directions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("origin lat 범위 위반 (>90) → 400 + 외부 호출 없음")
    void getDirections_invalidLat_returns400() throws Exception {
        Map<String, Object> body = Map.of(
                "origin", Map.of("lat", 91.0, "lng", 126.98),
                "destination", Map.of("lat", 37.58, "lng", 126.99)
        );

        mockMvc.perform(post("/api/route/directions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success", is(false)));

        verify(kakaoMobilityClient, never()).getDirections(any(), any(), anyList());
    }

    @Test
    @DisplayName("destination lng 범위 위반 (<-180) → 400")
    void getDirections_invalidLng_returns400() throws Exception {
        Map<String, Object> body = Map.of(
                "origin", Map.of("lat", 37.57, "lng", 126.98),
                "destination", Map.of("lat", 37.58, "lng", -181.0)
        );

        mockMvc.perform(post("/api/route/directions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest());

        verify(kakaoMobilityClient, never()).getDirections(any(), any(), anyList());
    }

    @Test
    @DisplayName("origin null → 400")
    void getDirections_nullOrigin_returns400() throws Exception {
        Map<String, Object> body = Map.of(
                "destination", Map.of("lat", 37.58, "lng", 126.99)
        );

        mockMvc.perform(post("/api/route/directions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest());

        verify(kakaoMobilityClient, never()).getDirections(any(), any(), anyList());
    }
}
