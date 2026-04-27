package com.filmroad.api.integration.koreatourism;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * 한국관광공사 KorService2 클라이언트. KakaoLocalClient 와 동일한 실패 정책 —
 * 외부 호출 실패/장애/키 누락 시 예외 throw 하지 않고 빈 리스트 반환.
 *
 * <p>고정 파라미터:</p>
 * <ul>
 *   <li>{@code numOfRows=10, pageNo=1}</li>
 *   <li>{@code MobileOS=ETC, MobileApp=Filmroad, _type=json}</li>
 *   <li>{@code arrange=C} (거리순)</li>
 *   <li>{@code radius=200000} (200km — 광범위)</li>
 *   <li>{@code contentTypeId=39} (음식점)</li>
 *   <li>{@code lclsSystm1=FD} (분류 — 음식)</li>
 * </ul>
 *
 * <p>동적 파라미터: {@code mapX} (longitude), {@code mapY} (latitude). lDongRegnCd /
 * lDongSignguCd 는 nullable — null 이면 좌표만으로 호출.</p>
 */
@Slf4j
@Component
public class KoreaTourismClient {

    /** locationBasedList2 path. */
    private static final String LOCATION_BASED_LIST_PATH = "/B551011/KorService2/locationBasedList2";

    private final KoreaTourismProperties properties;
    private final RestClient restClient;

    public KoreaTourismClient(KoreaTourismProperties properties) {
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
     * 좌표 기반 주변 음식점 조회. 매핑이 있으면 lDongRegnCd/lDongSignguCd 로 정확도 향상,
     * 없으면 좌표만으로 호출.
     */
    public List<KoreaTourismItem> findNearbyRestaurants(double lat, double lng, RegionCode regionCode) {
        if (!properties.isEnabled()) {
            return Collections.emptyList();
        }
        try {
            int numOfRows = properties.api() != null ? properties.api().numOfRows() : 10;
            int radius = properties.api() != null ? properties.api().radiusMeters() : 200_000;

            UriComponentsBuilder builder = UriComponentsBuilder.fromPath(LOCATION_BASED_LIST_PATH)
                    .queryParam("serviceKey", properties.serviceKey())
                    .queryParam("numOfRows", numOfRows)
                    .queryParam("pageNo", 1)
                    .queryParam("MobileOS", "ETC")
                    .queryParam("MobileApp", "Filmroad")
                    .queryParam("_type", "json")
                    .queryParam("arrange", "C")
                    .queryParam("radius", radius)
                    .queryParam("contentTypeId", 39)
                    .queryParam("lclsSystm1", "FD")
                    .queryParam("mapX", lng)
                    .queryParam("mapY", lat);

            if (regionCode != null) {
                builder.queryParam("lDongRegnCd", regionCode.lDongRegnCd())
                        .queryParam("lDongSignguCd", regionCode.lDongSignguCd());
            }

            URI uri = builder.build().encode().toUri();

            Map<String, Object> body = restClient.get()
                    .uri(uri)
                    .retrieve()
                    .body(Map.class);

            return extractItems(body);
        } catch (Exception ex) {
            log.debug("[KOREA-TOURISM] locationBasedList2 failed lat={} lng={} regionCode={}: {}",
                    lat, lng, regionCode, ex.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * 외부 응답 구조 `response.body.items.item[]` 에서 List<KoreaTourismItem> 추출.
     * 응답 shape 변형(item=null, item=Map 단건, items=빈 문자열) 모두 빈 리스트로 fallback.
     */
    @SuppressWarnings("unchecked")
    private static List<KoreaTourismItem> extractItems(Map<String, Object> body) {
        if (body == null) return Collections.emptyList();
        Object response = body.get("response");
        if (!(response instanceof Map<?, ?> respMap)) return Collections.emptyList();
        Object respBody = respMap.get("body");
        if (!(respBody instanceof Map<?, ?> bodyMap)) return Collections.emptyList();
        Object items = bodyMap.get("items");
        if (!(items instanceof Map<?, ?> itemsMap)) return Collections.emptyList();
        Object item = itemsMap.get("item");
        if (item instanceof List<?> list) {
            return list.stream()
                    .filter(o -> o instanceof Map<?, ?>)
                    .map(o -> (Map<String, Object>) o)
                    .map(KoreaTourismClient::toItem)
                    .toList();
        }
        if (item instanceof Map<?, ?> single) {
            return List.of(toItem((Map<String, Object>) single));
        }
        return Collections.emptyList();
    }

    private static KoreaTourismItem toItem(Map<String, Object> raw) {
        return new KoreaTourismItem(
                asString(raw.get("contentid")),
                asString(raw.get("title")),
                asString(raw.get("addr1")),
                parseInt(raw.get("dist")),
                asString(raw.get("tel")),
                asString(raw.get("firstimage")),
                parseDouble(raw.get("mapx")),
                parseDouble(raw.get("mapy"))
        );
    }

    private static String asString(Object value) {
        if (value == null) return null;
        String s = value.toString().trim();
        return s.isEmpty() ? null : s;
    }

    private static Double parseDouble(Object value) {
        String s = asString(value);
        if (s == null) return null;
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static Integer parseInt(Object value) {
        String s = asString(value);
        if (s == null) return null;
        try {
            // 외부 API 의 dist 가 소수로 올 가능성 대비 — 정수 변환.
            return (int) Math.round(Double.parseDouble(s));
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
