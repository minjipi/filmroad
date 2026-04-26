package com.filmroad.api.integration.kakao;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Kakao Local REST API 설정. application.yml `kakao.*` 키와 1:1 매핑.
 *
 * <p>{@code restApiKey} 는 {@code KAKAO_REST_API_KEY} 환경변수에서 주입되며, 누락 시
 * {@code disabled-kakao} sentinel 로 떨어진다. {@link KakaoLocalClient} 는 이 sentinel
 * 또는 빈 값일 때 외부 호출 없이 빈 결과를 즉시 반환해 dev 환경에서도 endpoint 가 500
 * 으로 깨지지 않도록 한다.</p>
 */
@ConfigurationProperties(prefix = "kakao")
public record KakaoLocalProperties(
        String restApiKey,
        Local local
) {
    public record Local(
            String baseUrl,
            int timeoutMs,
            int cacheTtlHours,
            int nearbyRadiusMeters
    ) {}

    public boolean isEnabled() {
        return restApiKey != null
                && !restApiKey.isBlank()
                && !"disabled-kakao".equals(restApiKey);
    }
}
