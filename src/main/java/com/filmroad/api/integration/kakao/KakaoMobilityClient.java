package com.filmroad.api.integration.kakao;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Kakao Mobility (Navi) Directions API 클라이언트.
 *
 * <p>{@code POST /v1/waypoints/directions} 를 호출해 출발 → 경유지 → 도착 경로 정보를
 * 가져온다. {@link KakaoLocalClient} 와 같은 REST 키 + {@code KakaoAK} 헤더를 사용한다.</p>
 *
 * <p>실패 정책은 {@link KakaoLocalClient} 와 동일: 키 sentinel / 빈 키 / 4xx / 5xx /
 * 타임아웃 / JSON 파싱 실패 → {@link Optional#empty()} + {@code log.debug}. 호출자 책임은
 * empty 면 {@code available=false} 응답을 만들어 프론트 섹션을 자연스럽게 숨기는 것.</p>
 *
 * <p><b>좌표 표기</b>: Kakao API 컨벤션을 그대로 따라 {@code x = 경도(lng)}, {@code y = 위도(lat)}.
 * 응답 {@code routes[0].sections[].roads[].vertexes} 도 {@code [x1, y1, x2, y2, ...]} flat array.</p>
 *
 * <p>{@link RestClient} 는 {@link KakaoIntegrationConfig#kakaoMobilityRestClient}
 * 에서 baseUrl/timeout/Authorization 헤더가 모두 적용된 채로 주입된다.</p>
 */
@Slf4j
@Component
public class KakaoMobilityClient {

    static final String DIRECTIONS_PATH = "/v1/waypoints/directions";

    private final KakaoLocalProperties properties;
    private final RestClient restClient;

    public KakaoMobilityClient(KakaoLocalProperties properties,
                               @Qualifier("kakaoMobilityRestClient") RestClient kakaoMobilityRestClient) {
        this.properties = properties;
        this.restClient = kakaoMobilityRestClient;
    }

    /**
     * 출발 → 경유지 → 도착 경로 조회.
     *
     * @param origin       출발 좌표
     * @param destination  도착 좌표
     * @param waypoints    경유지 (null/빈 리스트 OK, 카카오 모빌리티는 5개까지 권장)
     * @return 경로(path + 거리·시간 합계). 외부 실패 / 키 비활성 / 빈 응답 → empty.
     */
    public Optional<MobilityRoute> getDirections(LatLng origin, LatLng destination, List<LatLng> waypoints) {
        if (!properties.isEnabled()) {
            return Optional.empty();
        }
        if (origin == null || destination == null) {
            return Optional.empty();
        }

        try {
            Map<String, Object> body = buildRequestBody(origin, destination, waypoints);
            Map<String, Object> response = restClient.post()
                    .uri(DIRECTIONS_PATH)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            return parseRoute(response);
        } catch (Exception ex) {
            log.debug("[KAKAO-MOBILITY] directions failed origin={} dest={} waypoints={}: {}",
                    origin, destination, waypoints == null ? 0 : waypoints.size(), ex.getMessage());
            return Optional.empty();
        }
    }

    private static Map<String, Object> buildRequestBody(LatLng origin, LatLng destination, List<LatLng> waypoints) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("origin", coord(origin));
        body.put("destination", coord(destination));

        List<Map<String, Object>> wpJson = new ArrayList<>();
        if (waypoints != null) {
            int i = 0;
            for (LatLng wp : waypoints) {
                if (wp == null) continue;
                Map<String, Object> entry = coord(wp);
                entry.put("name", "wp" + i);
                wpJson.add(entry);
                i++;
            }
        }
        body.put("waypoints", wpJson);
        body.put("priority", "RECOMMEND");
        body.put("car_fuel", "GASOLINE");
        body.put("car_hipass", false);
        body.put("alternatives", false);
        body.put("road_details", false);
        // 카카오 모빌리티 사양: summary=true 면 sections/roads/vertexes 가 통째로 빠지고
        // summary 합계만 응답한다. polyline 좌표가 필요하므로 false (= 기본값) 명시.
        body.put("summary", false);
        return body;
    }

    private static Map<String, Object> coord(LatLng p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("x", p.lng());
        m.put("y", p.lat());
        return m;
    }

    @SuppressWarnings("unchecked")
    private static Optional<MobilityRoute> parseRoute(Map<String, Object> response) {
        if (response == null) return Optional.empty();
        Object routesObj = response.get("routes");
        if (!(routesObj instanceof List<?> routes) || routes.isEmpty()) {
            return Optional.empty();
        }
        Map<String, Object> route = (Map<String, Object>) routes.get(0);

        // 카카오 모빌리티는 경로를 못 찾을 때 result_code != 0 + 빈 sections 로 응답.
        Object resultCode = route.get("result_code");
        if (resultCode instanceof Number num && num.intValue() != 0) {
            return Optional.empty();
        }

        List<LatLng> path = new ArrayList<>();
        List<List<LatLng>> sectionsOut = new ArrayList<>();
        int distance = 0;
        int duration = 0;

        Object summary = route.get("summary");
        if (summary instanceof Map<?, ?> summaryMap) {
            distance = asInt(summaryMap.get("distance"));
            duration = asInt(summaryMap.get("duration"));
        }

        Object sectionsObj = route.get("sections");
        if (sectionsObj instanceof List<?> sections) {
            for (Object sec : sections) {
                if (!(sec instanceof Map<?, ?> sectionMap)) continue;
                Object roadsObj = sectionMap.get("roads");
                if (!(roadsObj instanceof List<?> roads)) continue;

                List<LatLng> sectionPath = new ArrayList<>();
                for (Object road : roads) {
                    if (!(road instanceof Map<?, ?> roadMap)) continue;
                    Object vertexesObj = roadMap.get("vertexes");
                    if (!(vertexesObj instanceof List<?> vertexes)) continue;
                    appendVertexes(sectionPath, vertexes);
                }
                if (!sectionPath.isEmpty()) {
                    sectionsOut.add(Collections.unmodifiableList(sectionPath));
                    path.addAll(sectionPath);
                }
            }
        }

        if (path.isEmpty() && distance == 0 && duration == 0) {
            return Optional.empty();
        }
        return Optional.of(new MobilityRoute(
                Collections.unmodifiableList(path),
                Collections.unmodifiableList(sectionsOut),
                distance,
                duration));
    }

    private static void appendVertexes(List<LatLng> path, List<?> vertexes) {
        // Kakao 응답: [x1, y1, x2, y2, ...] flat array (x = lng, y = lat).
        for (int i = 0; i + 1 < vertexes.size(); i += 2) {
            Double x = asDouble(vertexes.get(i));
            Double y = asDouble(vertexes.get(i + 1));
            if (x == null || y == null) continue;
            path.add(new LatLng(y, x));
        }
    }

    private static int asInt(Object value) {
        if (value instanceof Number n) return n.intValue();
        if (value == null) return 0;
        try {
            return Integer.parseInt(value.toString().trim());
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private static Double asDouble(Object value) {
        if (value instanceof Number n) return n.doubleValue();
        if (value == null) return null;
        try {
            return Double.parseDouble(value.toString().trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    /** 좌표쌍 — 위도/경도 순. */
    public record LatLng(double lat, double lng) {}

    /**
     * 카카오 모빌리티 directions 정규화 결과.
     *
     * <p>{@code path} 는 origin → destination 까지 이어지는 flat polyline.
     * {@code sections} 는 leg 별 path 리스트 — leg 0 은 origin → waypoint[0],
     * leg 1 은 waypoint[0] → waypoint[1], …, 마지막 leg 는 마지막 waypoint → destination.
     * 프론트가 leg 별 시각 분리(perpendicular pixel offset 등) 가 필요할 때 sections 를 사용,
     * 단순 polyline 만 그릴 때는 path 를 그대로 쓴다.</p>
     */
    public record MobilityRoute(List<LatLng> path,
                                List<List<LatLng>> sections,
                                int distanceMeters,
                                int durationSec) {}
}
