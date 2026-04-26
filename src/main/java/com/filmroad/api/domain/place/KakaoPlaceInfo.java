package com.filmroad.api.domain.place;

import com.filmroad.api.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
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
 * Kakao Local API 로 받아온 장소 메타데이터의 1:1 캐시. PK 는 Place.id 와 공유
 * ({@code @MapsId}) — 장소당 한 행만 존재.
 *
 * <p>{@code lastSyncedAt} 이 TTL(application.yml {@code kakao.local.cache-ttl-hours}) 보다
 * 오래되면 stale 로 간주, 서비스가 다시 외부 API 호출. 주변 맛집/카페는 캐시하지 않으므로
 * 여기엔 저장하지 않는다.</p>
 *
 * <p>Place 쪽에서는 양방향 연결을 두지 않는다 — 카카오 정보는 1:1 부속 데이터일 뿐이고
 * Place 본 도메인 객체에 추가 의존을 만들 이유가 없다. {@link KakaoPlaceInfoRepository}
 * 로만 access.</p>
 */
@Getter
@Entity
@Table(name = "kakao_place_info")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class KakaoPlaceInfo extends BaseEntity {

    @Id
    @Column(name = "place_id")
    private Long id;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "place_id")
    private Place place;

    @Column(name = "road_address", length = 300)
    private String roadAddress;

    @Column(name = "jibun_address", length = 300)
    private String jibunAddress;

    @Column(length = 30)
    private String phone;

    @Column(length = 200)
    private String category;

    @Column(name = "kakao_place_url", length = 500)
    private String kakaoPlaceUrl;

    @Column(name = "last_synced_at")
    private Date lastSyncedAt;

    public void update(String roadAddress, String jibunAddress, String phone,
                       String category, String kakaoPlaceUrl, Date lastSyncedAt) {
        this.roadAddress = roadAddress;
        this.jibunAddress = jibunAddress;
        this.phone = phone;
        this.category = category;
        this.kakaoPlaceUrl = kakaoPlaceUrl;
        this.lastSyncedAt = lastSyncedAt;
    }
}
