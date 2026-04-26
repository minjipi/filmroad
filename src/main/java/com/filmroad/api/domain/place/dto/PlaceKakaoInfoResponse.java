package com.filmroad.api.domain.place.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.Date;
import java.util.List;

/**
 * PlaceDetailPage 의 kakao-section 응답.
 *
 * <p>{@code available=false} 일 때 프론트는 섹션 통째로 숨긴다 — 카카오 키 미설정/장애로
 * 의미 있는 데이터를 못 받을 때 그 상태. 200 응답은 항상 유지.</p>
 */
@Getter
@Builder
public class PlaceKakaoInfoResponse {
    private String roadAddress;
    private String jibunAddress;
    private String phone;
    private String category;
    private String kakaoPlaceUrl;
    private Date lastSyncedAt;
    private List<KakaoNearbyDto> nearby;
    private boolean available;
}
