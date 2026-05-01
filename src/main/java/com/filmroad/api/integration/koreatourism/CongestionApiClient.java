package com.filmroad.api.integration.koreatourism;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * 한국관광공사 TatsCnctrRateService 클라이언트 — `tatsCnctrRatedList` 호출.
 *
 * <p>{@link KoreaTourismClient} 와 동일한 실패 정책: 외부 호출 실패/장애/키 누락 시 예외를
 * throw 하지 않고 빈 리스트 반환. 한 번 호출에 여러 날짜의 예측이 함께 오므로 service 가
 * baseDate 로 필터링한다.</p>
 *
 * <p>고정 파라미터:</p>
 * <ul>
 *   <li>{@code MobileOS=ETC, MobileApp=Filmroad, _type=json}</li>
 *   <li>{@code numOfRows=100, pageNo=1} — 한 번 호출로 충분한 날짜를 받기 위해</li>
 * </ul>
 *
 * <p>동적 파라미터: {@code areaCd} (광역, 2자리), {@code signguCd} (시군구, 5자리). {@code tAtsNm}
 * 은 nullable — 정확도 향상용 Place.name. 매핑이 없으면 호출하지 않으므로 areaCd/signguCd 는
 * non-null 보장.</p>
 */
@Slf4j
@Component
public class CongestionApiClient {

    private static final String TATSCNCTR_RATED_LIST_PATH = "/B551011/TatsCnctrRateService/tatsCnctrRatedList";
    private static final DateTimeFormatter BASE_YMD = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final KoreaTourismProperties properties;
    private final RestClient restClient;

    public CongestionApiClient(KoreaTourismProperties properties) {
        this.properties = properties;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        int timeout = properties.api() != null ? properties.api().timeoutMs() : 3000;
        factory.setConnectTimeout(timeout);
        factory.setReadTimeout(timeout);

        String baseUrl = properties.api() != null && properties.api().baseUrl() != null
                ? properties.api().baseUrl()
                : "https://apis.data.go.kr";

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .build();
    }

    /**
     * 관광지 혼잡도 예측 조회. 매핑이 있어야만 호출 — areaCd/signguCd 는 non-null 보장.
     * tAtsNm 은 nullable (있으면 정확도 향상).
     */
    public List<CongestionForecast> fetchForecasts(String areaCd, String signguCd, String tAtsNm) {
        if (!properties.isEnabled()) {
            return Collections.emptyList();
        }
        try {
            UriComponentsBuilder builder = UriComponentsBuilder.fromPath(TATSCNCTR_RATED_LIST_PATH)
                    .queryParam("serviceKey", properties.serviceKey())
                    .queryParam("numOfRows", 100)
                    .queryParam("pageNo", 1)
                    .queryParam("MobileOS", "ETC")
                    .queryParam("MobileApp", "Filmroad")
                    .queryParam("_type", "json")
                    .queryParam("areaCd", areaCd)
                    .queryParam("signguCd", signguCd);

            if (tAtsNm != null && !tAtsNm.isBlank()) {
                builder.queryParam("tAtsNm", tAtsNm);
            }

            URI uri = builder.build().encode().toUri();

            Map<String, Object> body = restClient.get()
                    .uri(uri)
                    .retrieve()
                    .body(Map.class);

            return extractForecasts(body);
        } catch (Exception ex) {
            log.debug("[CONGESTION] tatsCnctrRatedList failed areaCd={} signguCd={} tAtsNm={}: {}",
                    areaCd, signguCd, tAtsNm, ex.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * 외부 응답 `response.body.items.item[]` 에서 List<CongestionForecast> 추출.
     * item 이 List/Map 단건/null 셋 다 허용 (KoreaTourismClient 와 동일 패턴).
     */
    @SuppressWarnings("unchecked")
    private static List<CongestionForecast> extractForecasts(Map<String, Object> body) {
        if (body == null) return Collections.emptyList();
        Object response = body.get("response");
        if (!(response instanceof Map<?, ?> respMap)) return Collections.emptyList();
        Object respBody = respMap.get("body");
        if (!(respBody instanceof Map<?, ?> bodyMap)) return Collections.emptyList();
        Object items = bodyMap.get("items");
        if (!(items instanceof Map<?, ?> itemsMap)) return Collections.emptyList();
        Object item = itemsMap.get("item");

        List<Map<String, Object>> raws = new ArrayList<>();
        if (item instanceof List<?> list) {
            for (Object o : list) {
                if (o instanceof Map<?, ?>) raws.add((Map<String, Object>) o);
            }
        } else if (item instanceof Map<?, ?> single) {
            raws.add((Map<String, Object>) single);
        } else {
            return Collections.emptyList();
        }

        List<CongestionForecast> out = new ArrayList<>(raws.size());
        for (Map<String, Object> raw : raws) {
            CongestionForecast forecast = toForecast(raw);
            if (forecast != null) out.add(forecast);
        }
        return out;
    }

    private static CongestionForecast toForecast(Map<String, Object> raw) {
        LocalDate baseDate = parseBaseYmd(asString(raw.get("baseYmd")));
        Integer rate = parseInt(raw.get("cnctrRate"));
        if (baseDate == null || rate == null) return null;
        return new CongestionForecast(baseDate, rate);
    }

    private static LocalDate parseBaseYmd(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDate.parse(s, BASE_YMD);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private static String asString(Object value) {
        if (value == null) return null;
        String s = value.toString().trim();
        return s.isEmpty() ? null : s;
    }

    private static Integer parseInt(Object value) {
        String s = asString(value);
        if (s == null) return null;
        try {
            return (int) Math.round(Double.parseDouble(s));
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
