package com.filmroad.api.integration.koreatourism;

/**
 * 한국관광공사 KorService2 `locationBasedList2` 의 한 항목 — 외부 응답 구조에서 정규화된 내부 record.
 * 도메인 응답 DTO 로 매핑하기 직전 단계라 필드명이 외부 명세와 친숙하게 유지된다.
 */
public record KoreaTourismItem(
        String contentId,
        String title,
        String addr1,
        Integer distance,   // 미터 (외부 API 의 dist 값, 정수로 파싱)
        String tel,
        String imageUrl,    // 외부 firstimage (대표 이미지) 또는 null
        Double mapX,        // longitude
        Double mapY         // latitude
) {
}
