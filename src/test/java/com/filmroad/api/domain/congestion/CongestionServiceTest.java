package com.filmroad.api.domain.congestion;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.domain.congestion.dto.CongestionItemDto;
import com.filmroad.api.domain.congestion.dto.CongestionResponse;
import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceRepository;
import com.filmroad.api.integration.koreatourism.CongestionApiClient;
import com.filmroad.api.integration.koreatourism.CongestionForecast;
import com.filmroad.api.integration.koreatourism.RegionCode;
import com.filmroad.api.integration.koreatourism.RegionCodeLookup;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Pure-Mockito unit tests for {@link CongestionService}.
 *
 * <p>Clock 은 KST 2026-04-30 (목) 12:00 으로 고정하여:</p>
 * <ul>
 *   <li>오늘 = 2026-04-30 목요일</li>
 *   <li>내일 = 2026-05-01 금요일</li>
 *   <li>주말 = 2026-05-02 토 / 2026-05-03 일</li>
 * </ul>
 *
 * <p>검증 포인트: state 임계값, 오늘/내일/주말 매핑, 응답에 해당 날짜 없는 케이스, 매핑 실패,
 * 외부 API 실패, 캐시 hit/miss.</p>
 */
@ExtendWith(MockitoExtension.class)
class CongestionServiceTest {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    /** 2026-04-30 (목) 12:00 KST. fixed instant 는 UTC 기준 03:00. */
    private static final Clock FIXED_CLOCK = Clock.fixed(
            LocalDate.of(2026, 4, 30).atTime(12, 0).atZone(KST).toInstant(),
            KST
    );

    @Mock
    private PlaceRepository placeRepository;
    @Mock
    private PlaceCongestionCacheRepository cacheRepository;
    @Mock
    private RegionCodeLookup regionCodeLookup;
    @Mock
    private CongestionApiClient congestionApiClient;

    private CongestionService service;

    @BeforeEach
    void setUp() {
        service = new CongestionService(
                placeRepository,
                cacheRepository,
                regionCodeLookup,
                congestionApiClient,
                new ObjectMapper(),
                FIXED_CLOCK,
                6
        );
    }

    @Test
    @DisplayName("placeId 가 존재하지 않으면 PLACE_NOT_FOUND 예외")
    void getCongestion_unknownPlace_throws() {
        when(placeRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getCongestion(404L))
                .isInstanceOf(BaseException.class);

        verify(congestionApiClient, never()).fetchForecasts(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("regionLabel 매핑 실패 → available=false, 외부 API 호출 안 함")
    void getCongestion_regionLookupMiss_unavailable() {
        Place place = mockPlace(10L);
        when(placeRepository.findById(10L)).thenReturn(Optional.of(place));
        when(regionCodeLookup.lookup(anyString(), any())).thenReturn(Optional.empty());

        CongestionResponse response = service.getCongestion(10L);

        assertThat(response.isAvailable()).isFalse();
        assertThat(response.getForecasts()).isEmpty();
        verify(congestionApiClient, never()).fetchForecasts(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("정상 응답: 오늘/내일/주말 3건 모두 + state 임계값 매핑")
    void getCongestion_full_threeForecastsWithStates() {
        Place place = mockPlace(10L);
        when(placeRepository.findById(10L)).thenReturn(Optional.of(place));
        // 강원 강릉시 → (51, 150) 가정. signguCd 결합은 service 가 51+150=51150 처리.
        when(regionCodeLookup.lookup(anyString(), any())).thenReturn(Optional.of(new RegionCode("51", "150")));
        when(cacheRepository.findByPlaceId(10L)).thenReturn(Optional.empty());

        // 오늘=44 (OK), 내일=82 (PACK), 토=72 일=72 평균=72 (PACK)
        when(congestionApiClient.fetchForecasts(eq("51"), eq("51150"), anyString())).thenReturn(List.of(
                new CongestionForecast(LocalDate.of(2026, 4, 30), 44),
                new CongestionForecast(LocalDate.of(2026, 5, 1), 82),
                new CongestionForecast(LocalDate.of(2026, 5, 2), 72),
                new CongestionForecast(LocalDate.of(2026, 5, 3), 72)
        ));

        CongestionResponse response = service.getCongestion(10L);

        assertThat(response.isAvailable()).isTrue();
        assertThat(response.getSource()).isEqualTo("한국관광공사");
        assertThat(response.getForecasts()).hasSize(3);

        CongestionItemDto today = response.getForecasts().get(0);
        assertThat(today.getKey()).isEqualTo("TODAY");
        assertThat(today.getLabel()).isEqualTo("오늘");
        assertThat(today.getDateLabel()).isEqualTo("4/30 목");
        assertThat(today.getPercent()).isEqualTo(44);
        assertThat(today.getState()).isEqualTo("OK");

        CongestionItemDto tomorrow = response.getForecasts().get(1);
        assertThat(tomorrow.getKey()).isEqualTo("TOMORROW");
        assertThat(tomorrow.getLabel()).isEqualTo("내일");
        assertThat(tomorrow.getDateLabel()).isEqualTo("5/1 금");
        assertThat(tomorrow.getPercent()).isEqualTo(82);
        assertThat(tomorrow.getState()).isEqualTo("PACK");

        CongestionItemDto weekend = response.getForecasts().get(2);
        assertThat(weekend.getKey()).isEqualTo("WEEKEND");
        assertThat(weekend.getLabel()).isEqualTo("이번 주말");
        assertThat(weekend.getDateLabel()).isEqualTo("토·일 평균");
        assertThat(weekend.getPercent()).isEqualTo(72);
        assertThat(weekend.getState()).isEqualTo("PACK");
    }

    @Test
    @DisplayName("state 임계값: 50→OK, 51→BUSY, 70→BUSY, 71→PACK")
    void getCongestion_stateBoundaries() {
        assertThat(CongestionService.stateOf(0)).isEqualTo("OK");
        assertThat(CongestionService.stateOf(50)).isEqualTo("OK");
        assertThat(CongestionService.stateOf(51)).isEqualTo("BUSY");
        assertThat(CongestionService.stateOf(70)).isEqualTo("BUSY");
        assertThat(CongestionService.stateOf(71)).isEqualTo("PACK");
        assertThat(CongestionService.stateOf(100)).isEqualTo("PACK");
    }

    @Test
    @DisplayName("응답에 오늘 데이터 없음 → forecast 누락, 다른 항목만 채움")
    void getCongestion_missingTodayDate_skipsItem() {
        Place place = mockPlace(10L);
        when(placeRepository.findById(10L)).thenReturn(Optional.of(place));
        when(regionCodeLookup.lookup(anyString(), any())).thenReturn(Optional.of(new RegionCode("51", "150")));
        when(cacheRepository.findByPlaceId(10L)).thenReturn(Optional.empty());

        // 오늘(4/30) 없음, 내일(5/1)만, 주말 없음.
        when(congestionApiClient.fetchForecasts(anyString(), anyString(), anyString())).thenReturn(List.of(
                new CongestionForecast(LocalDate.of(2026, 5, 1), 30)
        ));

        CongestionResponse response = service.getCongestion(10L);

        assertThat(response.isAvailable()).isTrue();
        assertThat(response.getForecasts()).hasSize(1);
        assertThat(response.getForecasts().get(0).getKey()).isEqualTo("TOMORROW");
    }

    @Test
    @DisplayName("외부 API 가 빈 리스트 반환 + 캐시 없음 → available=false")
    void getCongestion_externalEmpty_unavailable() {
        Place place = mockPlace(10L);
        when(placeRepository.findById(10L)).thenReturn(Optional.of(place));
        when(regionCodeLookup.lookup(anyString(), any())).thenReturn(Optional.of(new RegionCode("51", "150")));
        when(cacheRepository.findByPlaceId(10L)).thenReturn(Optional.empty());
        when(congestionApiClient.fetchForecasts(anyString(), anyString(), anyString())).thenReturn(List.of());

        CongestionResponse response = service.getCongestion(10L);

        assertThat(response.isAvailable()).isFalse();
        assertThat(response.getForecasts()).isEmpty();
        verify(cacheRepository, never()).save(any());
    }

    @Test
    @DisplayName("응답에 해당 날짜 전혀 없음 (지난 날짜만) → available=false")
    void getCongestion_noMatchingDates_unavailable() {
        Place place = mockPlace(10L);
        when(placeRepository.findById(10L)).thenReturn(Optional.of(place));
        when(regionCodeLookup.lookup(anyString(), any())).thenReturn(Optional.of(new RegionCode("51", "150")));
        when(cacheRepository.findByPlaceId(10L)).thenReturn(Optional.empty());

        // 오늘(4/30) 이전 날짜만.
        when(congestionApiClient.fetchForecasts(anyString(), anyString(), anyString())).thenReturn(List.of(
                new CongestionForecast(LocalDate.of(2026, 4, 28), 50),
                new CongestionForecast(LocalDate.of(2026, 4, 29), 60)
        ));

        CongestionResponse response = service.getCongestion(10L);

        assertThat(response.isAvailable()).isFalse();
    }

    @Test
    @DisplayName("캐시 hit (TTL 안) → 외부 API 호출 안 함")
    void getCongestion_freshCache_skipsExternalCall() {
        Place place = mockPlace(10L);
        when(placeRepository.findById(10L)).thenReturn(Optional.of(place));
        when(regionCodeLookup.lookup(anyString(), any())).thenReturn(Optional.of(new RegionCode("51", "150")));

        // 캐시: 1시간 전, payload = 오늘+내일+주말 데이터.
        String payload = "[{\"date\":\"2026-04-30\",\"rate\":40},"
                + "{\"date\":\"2026-05-01\",\"rate\":60},"
                + "{\"date\":\"2026-05-02\",\"rate\":80},"
                + "{\"date\":\"2026-05-03\",\"rate\":80}]";
        PlaceCongestionCache cached = PlaceCongestionCache.builder()
                .place(place)
                .payloadJson(payload)
                .fetchedAt(Date.from(Instant.now(FIXED_CLOCK).minus(1, ChronoUnit.HOURS)))
                .build();
        when(cacheRepository.findByPlaceId(10L)).thenReturn(Optional.of(cached));

        CongestionResponse response = service.getCongestion(10L);

        assertThat(response.isAvailable()).isTrue();
        assertThat(response.getForecasts()).hasSize(3);
        assertThat(response.getForecasts().get(0).getPercent()).isEqualTo(40);   // OK
        assertThat(response.getForecasts().get(0).getState()).isEqualTo("OK");
        assertThat(response.getForecasts().get(1).getPercent()).isEqualTo(60);   // BUSY
        assertThat(response.getForecasts().get(1).getState()).isEqualTo("BUSY");
        assertThat(response.getForecasts().get(2).getPercent()).isEqualTo(80);   // PACK
        verify(congestionApiClient, never()).fetchForecasts(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("캐시 miss → 외부 호출 후 새 행 저장")
    void getCongestion_cacheMiss_persistsNewRow() {
        Place place = mockPlace(10L);
        when(placeRepository.findById(10L)).thenReturn(Optional.of(place));
        when(regionCodeLookup.lookup(anyString(), any())).thenReturn(Optional.of(new RegionCode("51", "150")));
        when(cacheRepository.findByPlaceId(10L)).thenReturn(Optional.empty());
        when(congestionApiClient.fetchForecasts(anyString(), anyString(), anyString())).thenReturn(List.of(
                new CongestionForecast(LocalDate.of(2026, 4, 30), 30)
        ));

        service.getCongestion(10L);

        ArgumentCaptor<PlaceCongestionCache> captor = ArgumentCaptor.forClass(PlaceCongestionCache.class);
        verify(cacheRepository, times(1)).save(captor.capture());
        assertThat(captor.getValue().getPayloadJson()).contains("2026-04-30").contains("30");
        assertThat(captor.getValue().getFetchedAt()).isNotNull();
    }

    @Test
    @DisplayName("캐시 expired → 외부 호출 + 기존 행 업데이트 (save 호출 X)")
    void getCongestion_expiredCache_updatesExisting() {
        Place place = mockPlace(10L);
        when(placeRepository.findById(10L)).thenReturn(Optional.of(place));
        when(regionCodeLookup.lookup(anyString(), any())).thenReturn(Optional.of(new RegionCode("51", "150")));

        Date stale = Date.from(Instant.now(FIXED_CLOCK).minus(48, ChronoUnit.HOURS));
        PlaceCongestionCache cached = PlaceCongestionCache.builder()
                .place(place)
                .payloadJson("[{\"date\":\"2026-04-28\",\"rate\":99}]")
                .fetchedAt(stale)
                .build();
        when(cacheRepository.findByPlaceId(10L)).thenReturn(Optional.of(cached));
        when(congestionApiClient.fetchForecasts(anyString(), anyString(), anyString())).thenReturn(List.of(
                new CongestionForecast(LocalDate.of(2026, 4, 30), 22)
        ));

        CongestionResponse response = service.getCongestion(10L);

        assertThat(response.getForecasts()).hasSize(1);
        assertThat(response.getForecasts().get(0).getPercent()).isEqualTo(22);
        assertThat(cached.getPayloadJson()).contains("2026-04-30").contains("22");
        assertThat(cached.getFetchedAt()).isAfter(stale);
        verify(cacheRepository, never()).save(any());
    }

    @Test
    @DisplayName("외부 호출 빈 결과 + 기존 expired 캐시 → 캐시 데이터로 응답 (stale-better-than-nothing)")
    void getCongestion_externalEmptyButCacheExists_keepsCache() {
        Place place = mockPlace(10L);
        when(placeRepository.findById(10L)).thenReturn(Optional.of(place));
        when(regionCodeLookup.lookup(anyString(), any())).thenReturn(Optional.of(new RegionCode("51", "150")));

        Date stale = Date.from(Instant.now(FIXED_CLOCK).minus(48, ChronoUnit.HOURS));
        // payload 가 오늘 데이터 포함 — 외부가 비어도 응답 가능.
        PlaceCongestionCache cached = PlaceCongestionCache.builder()
                .place(place)
                .payloadJson("[{\"date\":\"2026-04-30\",\"rate\":15}]")
                .fetchedAt(stale)
                .build();
        when(cacheRepository.findByPlaceId(10L)).thenReturn(Optional.of(cached));
        when(congestionApiClient.fetchForecasts(anyString(), anyString(), anyString())).thenReturn(List.of());

        CongestionResponse response = service.getCongestion(10L);

        assertThat(response.isAvailable()).isTrue();
        assertThat(response.getForecasts()).hasSize(1);
        assertThat(response.getForecasts().get(0).getPercent()).isEqualTo(15);
    }

    @Test
    @DisplayName("주말 산출: 오늘=일요일 → 다음 주 토·일 (지난 어제 토 안 씀)")
    void getCongestion_sundayToday_picksNextWeekend() {
        // 2026-05-03 (일) 12:00 KST 로 clock 재설정.
        Clock sundayClock = Clock.fixed(
                LocalDate.of(2026, 5, 3).atTime(12, 0).atZone(KST).toInstant(),
                KST
        );
        CongestionService sundayService = new CongestionService(
                placeRepository, cacheRepository, regionCodeLookup, congestionApiClient,
                new ObjectMapper(), sundayClock, 6
        );

        Place place = mockPlace(10L);
        when(placeRepository.findById(10L)).thenReturn(Optional.of(place));
        when(regionCodeLookup.lookup(anyString(), any())).thenReturn(Optional.of(new RegionCode("51", "150")));
        when(cacheRepository.findByPlaceId(10L)).thenReturn(Optional.empty());
        // 다음 주 토/일은 5/9, 5/10. 지난 토(5/2) 도 응답에 포함되지만 service 가 무시해야 함.
        when(congestionApiClient.fetchForecasts(anyString(), anyString(), anyString())).thenReturn(List.of(
                new CongestionForecast(LocalDate.of(2026, 5, 2), 99),  // 어제 토 — 사용 안 함
                new CongestionForecast(LocalDate.of(2026, 5, 3), 50),  // 오늘
                new CongestionForecast(LocalDate.of(2026, 5, 4), 30),  // 내일
                new CongestionForecast(LocalDate.of(2026, 5, 9), 60),  // 다음 토
                new CongestionForecast(LocalDate.of(2026, 5, 10), 40)  // 다음 일
        ));

        CongestionResponse response = sundayService.getCongestion(10L);

        CongestionItemDto weekend = response.getForecasts().stream()
                .filter(f -> "WEEKEND".equals(f.getKey()))
                .findFirst().orElseThrow();
        // (60+40)/2 = 50 → OK
        assertThat(weekend.getPercent()).isEqualTo(50);
        assertThat(weekend.getState()).isEqualTo("OK");
    }

    private static Place mockPlace(Long id) {
        return Place.builder()
                .id(id)
                .name("주문진 영진해변 방파제")
                .regionLabel("강원 강릉시 주문진읍")
                .latitude(37.89)
                .longitude(128.83)
                .trendingScore(0)
                .photoCount(0)
                .likeCount(0)
                .rating(0)
                .reviewCount(0)
                .nearbyRestaurantCount(0)
                .build();
    }
}
