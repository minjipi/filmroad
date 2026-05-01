package com.filmroad.api.integration.koreatourism;

import java.time.LocalDate;

/**
 * 한국관광공사 TatsCnctrRateService `tatsCnctrRatedList` 의 한 항목 — 외부 응답에서 정규화된 record.
 *
 * <p>한 번 호출에 여러 날짜의 예측이 함께 오므로, {@code baseDate} 별로 list 형태로 반환된다.
 * 도메인 응답 DTO 로 매핑하기 직전 단계라 의미 있는 한국어 명세 필드명을 그대로 노출한다.</p>
 *
 * @param baseDate    예측 기준 날짜 (외부 baseYmd YYYYMMDD 를 LocalDate 로 파싱)
 * @param rate        혼잡도 예측치 (0-100, percent)
 */
public record CongestionForecast(
        LocalDate baseDate,
        Integer rate
) {
}
