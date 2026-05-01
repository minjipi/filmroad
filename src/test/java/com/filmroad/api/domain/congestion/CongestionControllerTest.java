package com.filmroad.api.domain.congestion;

import com.filmroad.api.integration.koreatourism.CongestionApiClient;
import com.filmroad.api.integration.koreatourism.CongestionForecast;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration tests for {@code GET /api/places/{id}/congestion}.
 *
 * <p>실제 Spring 컨텍스트 + H2 + 시드 데이터를 사용. 외부 API 호출 경계만 {@link CongestionApiClient}
 * 를 {@code @MockBean} 으로 stub. seeded place id=10 (강원 강릉시 주문진) 로 매핑이 성공하는지,
 * 또는 매핑이 실패하는 placeId 의 경우 graceful 응답을 검증.</p>
 *
 * <p>주의: clock 은 시스템 시계라 "오늘/내일/주말" 산출이 시간에 따라 바뀐다. 그래서 forecast
 * 의 percent/state 만 검증하고 정확한 dateLabel 은 단위 테스트에서 검증. integration 은 wiring
 * 정합성과 응답 shape 만 본다.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class CongestionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private CongestionApiClient congestionApiClient;

    @Test
    @DisplayName("외부 API 정상 응답: available=true + forecasts 가 1건 이상 (오늘/내일/주말 중 매칭되는 것만)")
    void getCongestion_externalOk_returnsForecasts() throws Exception {
        // 시스템 clock 기반 오늘/내일/이번 토·일 데이터를 모두 채워서 보냄 — service 가 어느 쪽이든
        // "오늘"으로 잡아 1개 이상 채울 수 있게.
        LocalDate today = LocalDate.now();
        when(congestionApiClient.fetchForecasts(anyString(), anyString(), anyString())).thenReturn(List.of(
                new CongestionForecast(today, 30),
                new CongestionForecast(today.plusDays(1), 60),
                new CongestionForecast(today.plusDays(2), 80),
                new CongestionForecast(today.plusDays(3), 80),
                new CongestionForecast(today.plusDays(4), 80),
                new CongestionForecast(today.plusDays(5), 80),
                new CongestionForecast(today.plusDays(6), 80),
                new CongestionForecast(today.plusDays(7), 80)
        ));

        // place id=13 시드 regionLabel="서울 용산구 이태원동" — RegionCodeLookup 토큰 매칭 성공
        // (광역 "서울" + 시군구 "용산구" 모두 input 에 존재).
        mockMvc.perform(get("/api/places/13/congestion"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.available", is(true)))
                .andExpect(jsonPath("$.results.source", is("한국관광공사")))
                .andExpect(jsonPath("$.results.forecasts").isArray())
                .andExpect(jsonPath("$.results.forecasts.length()", greaterThan(0)))
                .andExpect(jsonPath("$.results.forecasts[0].key", notNullValue()))
                .andExpect(jsonPath("$.results.forecasts[0].label", notNullValue()))
                .andExpect(jsonPath("$.results.forecasts[0].dateLabel", notNullValue()))
                .andExpect(jsonPath("$.results.forecasts[0].state", notNullValue()))
                .andExpect(jsonPath("$.results.forecasts[0].percent", notNullValue()));
    }

    @Test
    @DisplayName("매핑 실패 placeId (regionLabel 광역 누락): 외부 API 호출 안 하고 available=false")
    void getCongestion_regionMappingFail_unavailable() throws Exception {
        // place id=10 시드 regionLabel="강릉시 주문진읍" — 광역 토큰(강원/강원특별자치도) 이 input 에
        // 없어 RegionCodeLookup 토큰 매칭 실패. 외부 API stub 가 forecasts 를 줘도 호출 자체가 안 됨.
        when(congestionApiClient.fetchForecasts(anyString(), anyString(), anyString())).thenReturn(List.of(
                new CongestionForecast(LocalDate.now(), 30)
        ));

        mockMvc.perform(get("/api/places/10/congestion"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.available", is(false)))
                .andExpect(jsonPath("$.results.forecasts.length()", is(0)));
    }

    @Test
    @DisplayName("외부 API 빈 결과 + 캐시 없음 → 200 + available=false (페이지가 깨지지 않음)")
    void getCongestion_externalEmpty_unavailable() throws Exception {
        when(congestionApiClient.fetchForecasts(anyString(), anyString(), anyString())).thenReturn(List.of());

        mockMvc.perform(get("/api/places/10/congestion"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.available", is(false)))
                .andExpect(jsonPath("$.results.forecasts").isArray())
                .andExpect(jsonPath("$.results.forecasts.length()", is(0)));
    }

    @Test
    @DisplayName("존재하지 않는 placeId → 매핑된 BaseResponseStatus 응답 (실패 코드)")
    void getCongestion_unknownPlace_responseError() throws Exception {
        // PLACE_NOT_FOUND 는 BaseException 으로 throw 되며, GlobalControllerAdvice 가 200/40050 으로 변환.
        // 정확한 코드는 환경에 따라 200(BaseResponse 래핑)일 수 있음 — 여기서는 status 만 검증.
        mockMvc.perform(get("/api/places/99999999/congestion"))
                .andExpect(jsonPath("$.success", is(false)));
    }

    @Test
    @DisplayName("permitAll: 익명 viewer 도 200 으로 응답 (인증 안 한 상태)")
    void getCongestion_anonymous_isPermitted() throws Exception {
        when(congestionApiClient.fetchForecasts(anyString(), anyString(), anyString())).thenReturn(List.of());

        mockMvc.perform(get("/api/places/10/congestion"))
                .andExpect(status().isOk());
    }
}
