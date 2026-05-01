package com.filmroad.api.domain.congestion;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.congestion.dto.CongestionItemDto;
import com.filmroad.api.domain.congestion.dto.CongestionResponse;
import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceRepository;
import com.filmroad.api.integration.koreatourism.CongestionApiClient;
import com.filmroad.api.integration.koreatourism.CongestionForecast;
import com.filmroad.api.integration.koreatourism.RegionCode;
import com.filmroad.api.integration.koreatourism.RegionCodeLookup;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * 한국관광공사 TatsCnctrRateService 기반 관광지 혼잡도 예측.
 *
 * <h3>흐름</h3>
 * <ol>
 *   <li>Place.regionLabel/address 로 {@link RegionCodeLookup#lookup} → (lDongRegnCd, lDongSignguCd)
 *       획득. 매핑 실패 시 즉시 {@code available=false}.</li>
 *   <li>(lDongRegnCd, lDongSignguCd) 를 혼잡도 API 형식 (areaCd=2자리 광역, signguCd=5자리 결합)
 *       로 변환. 예: 서울 종로구 (11, 110) → areaCd=11, signguCd=11110.</li>
 *   <li>{@link PlaceCongestionCache} TTL 안이면 캐시 그대로 사용. 만료/없음이면 외부 API 호출 후 upsert.</li>
 *   <li>응답에서 KST 오늘 / 내일 / 다가오는 토·일 평균을 골라 forecast 3건으로 가공.</li>
 * </ol>
 *
 * <p>실패 정책 (KakaoPlaceInfoService 와 동일): 외부 호출이 실패하거나 응답에서 의미 있는
 * 날짜를 못 찾으면 {@code available=false} 로 200 응답 — 페이지가 깨지지 않도록.</p>
 */
@Slf4j
@Service
public class CongestionService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter MONTH_DAY = DateTimeFormatter.ofPattern("M/d", Locale.KOREAN);
    private static final DateTimeFormatter DAY_OF_WEEK_KO =
            DateTimeFormatter.ofPattern("E", Locale.KOREAN);
    private static final String SOURCE_LABEL = "한국관광공사";
    private static final TypeReference<List<CachedForecast>> CACHE_LIST_TYPE =
            new TypeReference<>() {};

    private final PlaceRepository placeRepository;
    private final PlaceCongestionCacheRepository cacheRepository;
    private final RegionCodeLookup regionCodeLookup;
    private final CongestionApiClient congestionApiClient;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final int ttlHours;

    public CongestionService(PlaceRepository placeRepository,
                             PlaceCongestionCacheRepository cacheRepository,
                             RegionCodeLookup regionCodeLookup,
                             CongestionApiClient congestionApiClient,
                             ObjectMapper objectMapper,
                             Clock clock,
                             @Value("${app.congestion.ttl-hours:6}") int ttlHours) {
        this.placeRepository = placeRepository;
        this.cacheRepository = cacheRepository;
        this.regionCodeLookup = regionCodeLookup;
        this.congestionApiClient = congestionApiClient;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.ttlHours = ttlHours;
    }

    @Transactional
    public CongestionResponse getCongestion(Long placeId) {
        Place place = placeRepository.findById(placeId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.PLACE_NOT_FOUND));

        Optional<RegionCode> regionOpt = regionCodeLookup.lookup(place.getRegionLabel(), place.getAddress());
        if (regionOpt.isEmpty()) {
            log.debug("[CONGESTION] region lookup miss for placeId={} regionLabel='{}' address='{}'",
                    placeId, place.getRegionLabel(), place.getAddress());
            return unavailable();
        }

        RegionCode region = regionOpt.get();
        String areaCd = region.lDongRegnCd();
        String signguCd = region.lDongRegnCd() + region.lDongSignguCd();

        List<CachedForecast> forecasts = resolveForecasts(place, areaCd, signguCd);
        if (forecasts.isEmpty()) {
            return unavailable();
        }

        List<CongestionItemDto> items = buildItems(forecasts);
        if (items.isEmpty()) {
            return unavailable();
        }

        return CongestionResponse.builder()
                .available(true)
                .source(SOURCE_LABEL)
                .forecasts(items)
                .build();
    }

    /**
     * 캐시 hit (TTL 안) → 직렬화된 payload 역직렬화. miss/expired → 외부 API 호출 후 upsert.
     * 외부 호출 결과가 비면 기존 캐시(있다면) 그대로 사용 (stale-better-than-nothing 정책 —
     * KakaoPlaceInfoService 와 동일).
     */
    private List<CachedForecast> resolveForecasts(Place place, String areaCd, String signguCd) {
        Optional<PlaceCongestionCache> cachedOpt = cacheRepository.findByPlaceId(place.getId());

        if (cachedOpt.isPresent() && isFresh(cachedOpt.get())) {
            return deserialize(cachedOpt.get().getPayloadJson());
        }

        List<CongestionForecast> fetched = congestionApiClient.fetchForecasts(areaCd, signguCd, place.getName());

        if (fetched.isEmpty()) {
            return cachedOpt.map(c -> deserialize(c.getPayloadJson())).orElseGet(Collections::emptyList);
        }

        List<CachedForecast> normalized = fetched.stream()
                .map(f -> new CachedForecast(f.baseDate().toString(), f.rate()))
                .toList();

        String payload = serialize(normalized);
        Date now = Date.from(Instant.now(clock));

        if (cachedOpt.isPresent()) {
            cachedOpt.get().update(payload, now);
        } else {
            PlaceCongestionCache created = PlaceCongestionCache.builder()
                    .place(place)
                    .payloadJson(payload)
                    .fetchedAt(now)
                    .build();
            cacheRepository.save(created);
        }
        return normalized;
    }

    private boolean isFresh(PlaceCongestionCache cache) {
        if (cache.getFetchedAt() == null) return false;
        Duration age = Duration.between(cache.getFetchedAt().toInstant(), Instant.now(clock));
        return age.toHours() < ttlHours;
    }

    /**
     * 외부 응답 forecast 배열에서 KST 오늘 / 내일 / 다가오는 토·일 평균을 골라 3건 가공.
     * 각 항목은 해당 날짜 데이터가 없으면 누락 — buildItems 결과가 비면 caller 가
     * available=false 로 처리.
     */
    private List<CongestionItemDto> buildItems(List<CachedForecast> forecasts) {
        Map<LocalDate, Integer> byDate = new java.util.HashMap<>();
        for (CachedForecast f : forecasts) {
            LocalDate d = LocalDate.parse(f.date());
            byDate.put(d, f.rate());
        }

        LocalDate today = LocalDate.now(clock.withZone(KST));
        LocalDate tomorrow = today.plusDays(1);
        LocalDate[] weekend = upcomingWeekend(today);

        List<CongestionItemDto> items = new ArrayList<>(3);

        Integer todayRate = byDate.get(today);
        if (todayRate != null) {
            items.add(buildItem("TODAY", "오늘", formatDateLabel(today), todayRate));
        }

        Integer tomorrowRate = byDate.get(tomorrow);
        if (tomorrowRate != null) {
            items.add(buildItem("TOMORROW", "내일", formatDateLabel(tomorrow), tomorrowRate));
        }

        Integer satRate = byDate.get(weekend[0]);
        Integer sunRate = byDate.get(weekend[1]);
        Integer weekendAvg = average(satRate, sunRate);
        if (weekendAvg != null) {
            items.add(buildItem("WEEKEND", "이번 주말", "토·일 평균", weekendAvg));
        }

        return items;
    }

    /**
     * 다가오는 토·일 산출. 오늘이 일요일이면 다음 주 토·일을 사용 (이미 지난 어제 토 안 씀).
     * 그 외에는 해당 주의 토·일.
     */
    private static LocalDate[] upcomingWeekend(LocalDate today) {
        DayOfWeek dow = today.getDayOfWeek();
        LocalDate saturday;
        if (dow == DayOfWeek.SUNDAY) {
            saturday = today.plusDays(6);
        } else {
            int daysUntilSat = DayOfWeek.SATURDAY.getValue() - dow.getValue();
            saturday = today.plusDays(daysUntilSat);
        }
        return new LocalDate[]{saturday, saturday.plusDays(1)};
    }

    private static String formatDateLabel(LocalDate date) {
        return date.format(MONTH_DAY) + " " + date.format(DAY_OF_WEEK_KO);
    }

    private static CongestionItemDto buildItem(String key, String label, String dateLabel, int percent) {
        return CongestionItemDto.builder()
                .key(key)
                .label(label)
                .dateLabel(dateLabel)
                .percent(percent)
                .state(stateOf(percent))
                .build();
    }

    static String stateOf(int percent) {
        if (percent <= 50) return "OK";
        if (percent <= 70) return "BUSY";
        return "PACK";
    }

    private static Integer average(Integer a, Integer b) {
        if (a == null && b == null) return null;
        if (a == null) return b;
        if (b == null) return a;
        return Math.round((a + b) / 2.0f);
    }

    private static CongestionResponse unavailable() {
        return CongestionResponse.builder()
                .available(false)
                .source(SOURCE_LABEL)
                .forecasts(Collections.emptyList())
                .build();
    }

    private String serialize(List<CachedForecast> forecasts) {
        try {
            return objectMapper.writeValueAsString(forecasts);
        } catch (Exception ex) {
            log.warn("[CONGESTION] serialize failed: {}", ex.getMessage());
            return "[]";
        }
    }

    private List<CachedForecast> deserialize(String payloadJson) {
        if (payloadJson == null || payloadJson.isBlank()) return Collections.emptyList();
        try {
            return objectMapper.readValue(payloadJson, CACHE_LIST_TYPE);
        } catch (Exception ex) {
            log.warn("[CONGESTION] deserialize failed: {}", ex.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * 캐시 payload 직렬화 형식. LocalDate 를 ISO-8601 문자열로 보관해 의존성 추가 없이 직렬화 가능.
     * package-private — service 내부에서만 의미 있음.
     */
    record CachedForecast(String date, int rate) {
    }
}
