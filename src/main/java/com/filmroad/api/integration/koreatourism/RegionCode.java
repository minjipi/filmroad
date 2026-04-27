package com.filmroad.api.integration.koreatourism;

/**
 * 한국관광공사 API 의 보조 필터 — 광역(`lDongRegnCd`) + 시군구(`lDongSignguCd`) 코드 한 쌍.
 * {@link RegionCodeLookup} 가 정적 리소스(264 시군구 매핑) 에서 regionName 으로 lookup 하여 반환.
 *
 * <p>API 에 보내는 쿼리 파라미터 명과 동일한 의미를 그대로 노출 — 코드 어디에서도 명세와
 * 1:1 대응이라 디버깅 시 추적이 쉽다.</p>
 */
public record RegionCode(String lDongRegnCd, String lDongSignguCd) {
}
