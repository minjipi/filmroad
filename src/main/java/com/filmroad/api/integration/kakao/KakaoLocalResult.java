package com.filmroad.api.integration.kakao;

/**
 * Kakao Local REST API 응답에서 우리가 실제로 사용하는 필드만 추린 내부 표현.
 * keyword/category 검색 응답과 reverse-geocode 응답을 같은 형태로 정규화한다.
 *
 * <p>모든 필드는 nullable. 카카오가 누락하는 경우(예: phone 없는 장소, 도로명 미등록 주소)
 * 가 흔하므로 호출 측에서 nullable 임을 전제로 다룬다.</p>
 */
public record KakaoLocalResult(
        String placeName,
        String roadAddress,
        String jibunAddress,
        String phone,
        String placeUrl,
        String categoryName,
        String categoryGroupCode,
        Double latitude,
        Double longitude,
        Integer distanceMeters
) {}
