package com.filmroad.api.integration.kakao;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Unit tests for {@link KakaoMobilityClient}. RestClient.Builder + MockRestServiceServer
 * 로 HTTP 경계만 mock — 파싱 로직은 실제 코드 그대로 실행.
 *
 * <p>커버 케이스:</p>
 * <ul>
 *     <li>키 sentinel ({@code disabled-kakao}) → 외부 호출 없이 empty</li>
 *     <li>정상 응답 → vertexes 두 개씩 묶어 path 빌드, summary 합계 추출</li>
 *     <li>vertexes/summary 모두 비면 empty</li>
 *     <li>result_code != 0 (경로 못 찾음) → empty</li>
 *     <li>외부 5xx → 예외 삼키고 empty</li>
 * </ul>
 */
class KakaoMobilityClientTest {

    private static final String BASE_URL = "https://apis-navi.kakaomobility.com";
    private static final KakaoLocalProperties.Mobility MOBILITY =
            new KakaoLocalProperties.Mobility(BASE_URL, 5000);

    private record Setup(KakaoMobilityClient client, MockRestServiceServer server) {}

    private Setup buildClient(String apiKey) {
        KakaoLocalProperties props = new KakaoLocalProperties(apiKey, null, MOBILITY);
        RestClient.Builder builder = RestClient.builder()
                .baseUrl(BASE_URL)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "KakaoAK " + apiKey)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        RestClient restClient = builder.build();
        KakaoMobilityClient client = new KakaoMobilityClient(props, restClient);
        return new Setup(client, server);
    }

    @Test
    @DisplayName("키 sentinel: 외부 호출 없이 Optional.empty()")
    void getDirections_disabledKey_returnsEmptyWithoutHttp() {
        Setup s = buildClient("disabled-kakao");

        Optional<KakaoMobilityClient.MobilityRoute> result = s.client.getDirections(
                new KakaoMobilityClient.LatLng(37.57, 126.98),
                new KakaoMobilityClient.LatLng(37.58, 126.99),
                List.of()
        );

        assertThat(result).isEmpty();
        s.server.verify();
    }

    @Test
    @DisplayName("정상 응답: vertexes 두 개씩 묶어 path 만들고 summary 추출")
    void getDirections_validResponse_parsesPathAndSummary() {
        Setup s = buildClient("real-key");

        // 2개 section, 첫 section 두 road / 두 번째 한 road. path 는 평탄화 결과.
        String body = """
                {
                  "routes": [{
                    "result_code": 0,
                    "summary": {"distance": 38500, "duration": 5400},
                    "sections": [
                      {
                        "roads": [
                          {"vertexes": [126.98, 37.57, 126.985, 37.572]},
                          {"vertexes": [126.985, 37.572, 126.99, 37.575]}
                        ]
                      },
                      {
                        "roads": [
                          {"vertexes": [126.99, 37.575, 126.995, 37.578, 127.0, 37.58]}
                        ]
                      }
                    ]
                  }]
                }
                """;

        s.server.expect(requestTo(BASE_URL + KakaoMobilityClient.DIRECTIONS_PATH))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "KakaoAK real-key"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        Optional<KakaoMobilityClient.MobilityRoute> result = s.client.getDirections(
                new KakaoMobilityClient.LatLng(37.57, 126.98),
                new KakaoMobilityClient.LatLng(37.58, 127.0),
                List.of(new KakaoMobilityClient.LatLng(37.575, 126.99))
        );

        assertThat(result).isPresent();
        KakaoMobilityClient.MobilityRoute route = result.get();
        assertThat(route.distanceMeters()).isEqualTo(38500);
        assertThat(route.durationSec()).isEqualTo(5400);
        // path = 4 (section1) + 3 (section2) = 7
        assertThat(route.path()).hasSize(7);
        assertThat(route.path().get(0).lat()).isCloseTo(37.57, within(1e-6));
        assertThat(route.path().get(0).lng()).isCloseTo(126.98, within(1e-6));
        assertThat(route.path().get(6).lat()).isCloseTo(37.58, within(1e-6));
        assertThat(route.path().get(6).lng()).isCloseTo(127.0, within(1e-6));
        // sections = 2, 첫 section 4 좌표, 두 번째 3 좌표.
        assertThat(route.sections()).hasSize(2);
        assertThat(route.sections().get(0)).hasSize(4);
        assertThat(route.sections().get(1)).hasSize(3);
        // 첫 section 의 끝과 두 번째 section 의 시작은 카카오 응답상 동일 좌표(연결점).
        assertThat(route.sections().get(0).get(3).lat()).isCloseTo(37.575, within(1e-6));
        assertThat(route.sections().get(1).get(0).lat()).isCloseTo(37.575, within(1e-6));
        s.server.verify();
    }

    @Test
    @DisplayName("vertexes 와 summary 모두 비면 empty")
    void getDirections_emptyVertexesAndSummary_returnsEmpty() {
        Setup s = buildClient("real-key");

        String body = """
                {
                  "routes": [{
                    "result_code": 0,
                    "summary": {"distance": 0, "duration": 0},
                    "sections": [{"roads": []}]
                  }]
                }
                """;
        s.server.expect(requestTo(BASE_URL + KakaoMobilityClient.DIRECTIONS_PATH))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        Optional<KakaoMobilityClient.MobilityRoute> result = s.client.getDirections(
                new KakaoMobilityClient.LatLng(37.57, 126.98),
                new KakaoMobilityClient.LatLng(37.58, 126.99),
                null
        );

        assertThat(result).isEmpty();
        s.server.verify();
    }

    @Test
    @DisplayName("result_code != 0 (경로 못 찾음) → empty")
    void getDirections_nonZeroResultCode_returnsEmpty() {
        Setup s = buildClient("real-key");

        String body = """
                {
                  "routes": [{
                    "result_code": 104,
                    "result_msg": "출발지와 도착지가 너무 가깝습니다."
                  }]
                }
                """;
        s.server.expect(requestTo(BASE_URL + KakaoMobilityClient.DIRECTIONS_PATH))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        Optional<KakaoMobilityClient.MobilityRoute> result = s.client.getDirections(
                new KakaoMobilityClient.LatLng(37.57, 126.98),
                new KakaoMobilityClient.LatLng(37.5701, 126.9801),
                null
        );

        assertThat(result).isEmpty();
        s.server.verify();
    }

    @Test
    @DisplayName("외부 5xx → 예외 삼키고 empty")
    void getDirections_serverError_returnsEmpty() {
        Setup s = buildClient("real-key");

        s.server.expect(requestTo(BASE_URL + KakaoMobilityClient.DIRECTIONS_PATH))
                .andRespond(withServerError());

        Optional<KakaoMobilityClient.MobilityRoute> result = s.client.getDirections(
                new KakaoMobilityClient.LatLng(37.57, 126.98),
                new KakaoMobilityClient.LatLng(37.58, 126.99),
                List.of(new KakaoMobilityClient.LatLng(37.575, 126.985))
        );

        assertThat(result).isEmpty();
        s.server.verify();
    }

    @Test
    @DisplayName("origin/destination null → 외부 호출 없이 empty")
    void getDirections_nullCoords_returnsEmpty() {
        Setup s = buildClient("real-key");

        assertThat(s.client.getDirections(null, new KakaoMobilityClient.LatLng(37.5, 127.0), null)).isEmpty();
        assertThat(s.client.getDirections(new KakaoMobilityClient.LatLng(37.5, 127.0), null, null)).isEmpty();
        s.server.verify();
    }
}
