package com.filmroad.api.integration.kakao;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Kakao Local REST API 클라이언트. 외부 의존성 없이 Spring 6 RestClient 사용.
 *
 * <p>실패 시 예외를 throw 하지 않고 빈 결과를 반환하는 것이 핵심. 카카오 API 가 quota
 * 초과 / 일시 장애 / 키 누락이어도 endpoint 자체가 200 으로 응답하고 프론트엔드는
 * {@code available=false} 로 섹션을 숨긴다.</p>
 *
 * <p>API 키가 sentinel({@code disabled-kakao}) 또는 빈 문자열이면 모든 메서드가 즉시
 * 빈 결과를 반환해 dev 환경에서도 깨지지 않는다.</p>
 */
@Slf4j
@Component
public class KakaoLocalClient {

    private final KakaoLocalProperties properties;
    private final RestClient restClient;

    public KakaoLocalClient(KakaoLocalProperties properties) {
        this.properties = properties;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        int timeout = properties.local() != null ? properties.local().timeoutMs() : 3000;
        factory.setConnectTimeout(timeout);
        factory.setReadTimeout(timeout);

        String baseUrl = properties.local() != null && properties.local().baseUrl() != null
                ? properties.local().baseUrl()
                : "https://dapi.kakao.com";

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "KakaoAK " + (properties.restApiKey() == null ? "" : properties.restApiKey()))
                .build();
    }

    /**
     * 키워드 검색. lat/lng 가 주어지면 그 좌표 근방을 가산점, 0건이면 reverse-geocode 폴백.
     */
    public Optional<KakaoLocalResult> findPlace(String name, double lat, double lng) {
        if (!properties.isEnabled()) {
            return Optional.empty();
        }
        try {
            URI uri = UriComponentsBuilder.fromPath("/v2/local/search/keyword.json")
                    .queryParam("query", name)
                    .queryParam("x", lng)
                    .queryParam("y", lat)
                    .queryParam("radius", 1000)
                    .queryParam("sort", "accuracy")
                    .queryParam("size", 5)
                    .build()
                    .encode()
                    .toUri();

            Map<String, Object> body = restClient.get()
                    .uri(uri)
                    .retrieve()
                    .body(Map.class);

            List<Map<String, Object>> documents = extractDocuments(body);
            if (!documents.isEmpty()) {
                return Optional.of(toKeywordResult(documents.get(0)));
            }
        } catch (Exception ex) {
            log.debug("[KAKAO] keyword search failed for name={} lat={} lng={}: {}", name, lat, lng, ex.getMessage());
        }
        return reverseGeocode(lat, lng);
    }

    /**
     * 카테고리 검색 — 주변 맛집(FD6) / 카페(CE7) 등.
     */
    public List<KakaoLocalResult> findNearby(String categoryCode, double lat, double lng, int radius) {
        if (!properties.isEnabled()) {
            return Collections.emptyList();
        }
        try {
            URI uri = UriComponentsBuilder.fromPath("/v2/local/search/category.json")
                    .queryParam("category_group_code", categoryCode)
                    .queryParam("x", lng)
                    .queryParam("y", lat)
                    .queryParam("radius", radius)
                    .queryParam("sort", "distance")
                    .queryParam("size", 5)
                    .build()
                    .encode()
                    .toUri();

            Map<String, Object> body = restClient.get()
                    .uri(uri)
                    .retrieve()
                    .body(Map.class);

            return extractDocuments(body).stream()
                    .map(KakaoLocalClient::toKeywordResult)
                    .toList();
        } catch (Exception ex) {
            log.debug("[KAKAO] category search failed code={} lat={} lng={}: {}", categoryCode, lat, lng, ex.getMessage());
            return Collections.emptyList();
        }
    }

    private Optional<KakaoLocalResult> reverseGeocode(double lat, double lng) {
        try {
            URI uri = UriComponentsBuilder.fromPath("/v2/local/geo/coord2address.json")
                    .queryParam("x", lng)
                    .queryParam("y", lat)
                    .build()
                    .encode()
                    .toUri();

            Map<String, Object> body = restClient.get()
                    .uri(uri)
                    .retrieve()
                    .body(Map.class);

            List<Map<String, Object>> documents = extractDocuments(body);
            if (documents.isEmpty()) {
                return Optional.empty();
            }
            Map<String, Object> doc = documents.get(0);
            Map<String, Object> road = asMap(doc.get("road_address"));
            Map<String, Object> jibun = asMap(doc.get("address"));

            return Optional.of(new KakaoLocalResult(
                    null,
                    road != null ? asString(road.get("address_name")) : null,
                    jibun != null ? asString(jibun.get("address_name")) : null,
                    null,
                    null,
                    null,
                    null,
                    lat,
                    lng,
                    null
            ));
        } catch (Exception ex) {
            log.debug("[KAKAO] reverse-geocode failed lat={} lng={}: {}", lat, lng, ex.getMessage());
            return Optional.empty();
        }
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> extractDocuments(Map<String, Object> body) {
        if (body == null) return Collections.emptyList();
        Object docs = body.get("documents");
        if (docs instanceof List<?> list) {
            return (List<Map<String, Object>>) list;
        }
        return Collections.emptyList();
    }

    private static KakaoLocalResult toKeywordResult(Map<String, Object> doc) {
        return new KakaoLocalResult(
                asString(doc.get("place_name")),
                asString(doc.get("road_address_name")),
                asString(doc.get("address_name")),
                asString(doc.get("phone")),
                asString(doc.get("place_url")),
                asString(doc.get("category_name")),
                asString(doc.get("category_group_code")),
                parseDouble(doc.get("y")),
                parseDouble(doc.get("x")),
                parseInt(doc.get("distance"))
        );
    }

    private static String asString(Object value) {
        if (value == null) return null;
        String s = value.toString().trim();
        return s.isEmpty() ? null : s;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object value) {
        return value instanceof Map<?, ?> m ? (Map<String, Object>) m : null;
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
            return Integer.parseInt(s);
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
