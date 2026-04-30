package com.filmroad.api.integration.kakao;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * Kakao 외부 통신용 {@link RestClient} 빈 정의.
 *
 * <p>RestClient 구성을 컨테이너에 두는 이유는 테스트에서 {@code MockRestServiceServer}
 * 로 HTTP 경계를 가짜로 대체할 수 있도록 하기 위함이다. 클라이언트 클래스(예
 * {@link KakaoMobilityClient}) 가 직접 {@code RestClient.Builder} 를 받아 timeout/
 * requestFactory 를 덮어쓰면, 테스트의 mock factory 가 함께 덮어써져 mock 이 무시된다.</p>
 */
@Configuration
public class KakaoIntegrationConfig {

    private static final String DEFAULT_MOBILITY_BASE_URL = "https://apis-navi.kakaomobility.com";
    private static final int DEFAULT_MOBILITY_TIMEOUT_MS = 5000;

    /** Kakao Mobility (Navi) Directions 호출 전용 RestClient. */
    @Bean(name = "kakaoMobilityRestClient")
    public RestClient kakaoMobilityRestClient(KakaoLocalProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        int timeout = properties.mobility() != null
                ? properties.mobility().timeoutMs()
                : DEFAULT_MOBILITY_TIMEOUT_MS;
        factory.setConnectTimeout(timeout);
        factory.setReadTimeout(timeout);

        String baseUrl = properties.mobility() != null && properties.mobility().baseUrl() != null
                ? properties.mobility().baseUrl()
                : DEFAULT_MOBILITY_BASE_URL;

        String apiKey = properties.restApiKey() == null ? "" : properties.restApiKey();

        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "KakaoAK " + apiKey)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }
}
