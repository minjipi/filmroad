package com.filmroad.api.integration.koreatourism;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 한국관광공사 KorService2 API 설정. application.yml `korea-tourism.*` 키와 1:1 매핑.
 *
 * <p>{@code serviceKey} 는 {@code KOREA_TOURISM_KEY} 환경변수에서 주입되며, 누락 시
 * {@code disabled-korea-tourism} sentinel 로 떨어진다. {@link KoreaTourismClient} 는
 * sentinel/빈 값일 때 외부 호출 없이 빈 리스트를 즉시 반환해 dev/test 환경에서도
 * endpoint 가 500 으로 깨지지 않는다 (KakaoLocalProperties 와 동일 패턴).</p>
 *
 * @param serviceKey 한국관광공사 OpenAPI 서비스키 (URL-encoded 형태가 일반적이지만 RestClient 가
 *                   queryParam 으로 다시 인코딩하므로 raw key 권장).
 * @param api        세부 호출 옵션 (baseUrl / timeout / 페이지 크기 / radius 등).
 */
@ConfigurationProperties(prefix = "korea-tourism")
public record KoreaTourismProperties(
        String serviceKey,
        Api api
) {
    public record Api(
            String baseUrl,
            int timeoutMs,
            int numOfRows,
            int radiusMeters
    ) {}

    public boolean isEnabled() {
        return serviceKey != null
                && !serviceKey.isBlank()
                && !"disabled-korea-tourism".equals(serviceKey);
    }
}
