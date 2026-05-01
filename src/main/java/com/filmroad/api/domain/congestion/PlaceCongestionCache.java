package com.filmroad.api.domain.congestion;

import com.filmroad.api.common.model.BaseEntity;
import com.filmroad.api.domain.place.Place;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * 한국관광공사 TatsCnctrRateService 응답의 1:1 캐시. PK 는 Place.id 와 공유 ({@code @MapsId}) —
 * 장소당 한 행만 존재.
 *
 * <p>{@code fetchedAt} 이 TTL(application.yml {@code app.congestion.ttl-hours}) 보다 오래되면
 * stale 로 간주, 서비스가 다시 외부 API 를 호출. 응답 payload 자체는 JSON 으로 직렬화하여
 * 보관 — 외부 API 가 한 번에 여러 날짜를 반환하므로 service 에서 오늘/내일/주말 산출 시 다시
 * 파싱하여 사용한다. {@link com.filmroad.api.domain.place.KakaoPlaceInfo} 와 동일한 1:1 패턴.</p>
 *
 * <p>Place 쪽에서는 양방향 연결을 두지 않는다 — 부속 캐시일 뿐 도메인 의존을 만들 이유가 없다.
 * {@link PlaceCongestionCacheRepository} 로만 access.</p>
 */
@Getter
@Entity
@Table(name = "place_congestion_cache")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class PlaceCongestionCache extends BaseEntity {

    @Id
    @Column(name = "place_id")
    private Long id;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "place_id")
    private Place place;

    /** 외부 API 응답에서 추출한 forecast 배열의 JSON 문자열. service 가 직렬/역직렬화 책임. */
    @Lob
    @Column(name = "payload_json", nullable = false, columnDefinition = "TEXT")
    private String payloadJson;

    @Column(name = "fetched_at", nullable = false)
    private Date fetchedAt;

    public void update(String payloadJson, Date fetchedAt) {
        this.payloadJson = payloadJson;
        this.fetchedAt = fetchedAt;
    }
}
