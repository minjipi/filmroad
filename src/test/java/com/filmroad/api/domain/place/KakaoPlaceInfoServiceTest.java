package com.filmroad.api.domain.place;

import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.domain.place.dto.PlaceKakaoInfoResponse;
import com.filmroad.api.integration.kakao.KakaoLocalClient;
import com.filmroad.api.integration.kakao.KakaoLocalProperties;
import com.filmroad.api.integration.kakao.KakaoLocalResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link KakaoPlaceInfoService} cache + fallback logic.
 *
 * <p>Pure Mockito — no Spring context. Verifies:
 * <ul>
 *   <li>Cache hit (fresh) → no external call</li>
 *   <li>Cache miss → external call + persist</li>
 *   <li>Cache expired → external call + update existing row</li>
 *   <li>Key disabled / external returns empty → cached fallback or available=false</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class KakaoPlaceInfoServiceTest {

    @Mock
    private PlaceRepository placeRepository;
    @Mock
    private KakaoPlaceInfoRepository kakaoPlaceInfoRepository;
    @Mock
    private KakaoLocalClient kakaoLocalClient;

    private KakaoLocalProperties properties;

    @InjectMocks
    private KakaoPlaceInfoService service;

    @BeforeEach
    void setUp() throws Exception {
        properties = new KakaoLocalProperties(
                "test-key",
                new KakaoLocalProperties.Local("https://dapi.kakao.com", 3000, 24, 500),
                new KakaoLocalProperties.Mobility("https://apis-navi.kakaomobility.com", 5000)
        );
        // KakaoLocalProperties는 record라 @InjectMocks가 채워주지 않음 → 리플렉션으로 주입.
        Field f = KakaoPlaceInfoService.class.getDeclaredField("properties");
        f.setAccessible(true);
        f.set(service, properties);
    }

    @Test
    @DisplayName("placeId 가 존재하지 않으면 PLACE_NOT_FOUND 예외")
    void getOrFetch_unknownPlace_throws() {
        when(placeRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getOrFetch(404L))
                .isInstanceOf(BaseException.class);

        verify(kakaoLocalClient, never()).findPlace(anyString(), anyDouble(), anyDouble());
    }

    @Test
    @DisplayName("캐시 hit (TTL 내) → 외부 호출 없이 캐시 그대로 반환, available=true")
    void getOrFetch_freshCache_skipsExternalCall() {
        Place place = mockPlace(10L, "주문진 영진해변 방파제", 37.89, 128.83);
        when(placeRepository.findById(10L)).thenReturn(Optional.of(place));

        KakaoPlaceInfo cached = KakaoPlaceInfo.builder()
                .place(place)
                .roadAddress("강원 강릉시 주문진읍 ...")
                .phone("033-0000-0000")
                .lastSyncedAt(Date.from(Instant.now().minus(1, ChronoUnit.HOURS)))
                .build();
        when(kakaoPlaceInfoRepository.findByPlaceId(10L)).thenReturn(Optional.of(cached));
        // nearby 는 항상 호출됨 — 빈 리스트 반환.
        when(kakaoLocalClient.findNearby(anyString(), anyDouble(), anyDouble(), anyInt()))
                .thenReturn(List.of());

        PlaceKakaoInfoResponse response = service.getOrFetch(10L);

        assertThat(response.getRoadAddress()).isEqualTo("강원 강릉시 주문진읍 ...");
        assertThat(response.isAvailable()).isTrue();
        verify(kakaoLocalClient, never()).findPlace(anyString(), anyDouble(), anyDouble());
    }

    @Test
    @DisplayName("캐시 miss → 외부 호출 후 새 행 저장, available=true")
    void getOrFetch_cacheMiss_persistsNewRow() {
        Place place = mockPlace(10L, "주문진 영진해변 방파제", 37.89, 128.83);
        when(placeRepository.findById(10L)).thenReturn(Optional.of(place));
        when(kakaoPlaceInfoRepository.findByPlaceId(10L)).thenReturn(Optional.empty());

        KakaoLocalResult fetched = new KakaoLocalResult(
                "주문진 영진해변 방파제",
                "강원 강릉시 주문진읍 교항리 산51-2",
                "강원 강릉시 주문진읍 교항리 산51-2",
                "033-640-5420",
                "https://place.map.kakao.com/8138648",
                "여행 > 관광,명소 > 해변",
                "AT4",
                37.89, 128.83, null
        );
        when(kakaoLocalClient.findPlace(eq("주문진 영진해변 방파제"), eq(37.89), eq(128.83)))
                .thenReturn(Optional.of(fetched));
        when(kakaoLocalClient.findNearby(anyString(), anyDouble(), anyDouble(), anyInt()))
                .thenReturn(List.of());
        when(kakaoPlaceInfoRepository.save(any(KakaoPlaceInfo.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        PlaceKakaoInfoResponse response = service.getOrFetch(10L);

        assertThat(response.isAvailable()).isTrue();
        assertThat(response.getRoadAddress()).isEqualTo("강원 강릉시 주문진읍 교항리 산51-2");
        assertThat(response.getKakaoPlaceUrl()).isEqualTo("https://place.map.kakao.com/8138648");

        ArgumentCaptor<KakaoPlaceInfo> captor = ArgumentCaptor.forClass(KakaoPlaceInfo.class);
        verify(kakaoPlaceInfoRepository, times(1)).save(captor.capture());
        assertThat(captor.getValue().getPhone()).isEqualTo("033-640-5420");
        assertThat(captor.getValue().getLastSyncedAt()).isNotNull();
    }

    @Test
    @DisplayName("캐시 expired (TTL 초과) → 외부 호출 후 기존 행 업데이트")
    void getOrFetch_expiredCache_updatesExistingRow() {
        Place place = mockPlace(10L, "주문진 영진해변 방파제", 37.89, 128.83);
        when(placeRepository.findById(10L)).thenReturn(Optional.of(place));

        Date stale = Date.from(Instant.now().minus(48, ChronoUnit.HOURS));
        KakaoPlaceInfo cached = KakaoPlaceInfo.builder()
                .place(place)
                .roadAddress("OLD")
                .lastSyncedAt(stale)
                .build();
        when(kakaoPlaceInfoRepository.findByPlaceId(10L)).thenReturn(Optional.of(cached));

        KakaoLocalResult fresh = new KakaoLocalResult(
                "주문진 영진해변 방파제",
                "NEW road",
                "NEW jibun",
                "033-640-5420",
                "https://place.map.kakao.com/8138648",
                "여행 > 관광,명소 > 해변",
                "AT4",
                37.89, 128.83, null
        );
        when(kakaoLocalClient.findPlace(anyString(), anyDouble(), anyDouble()))
                .thenReturn(Optional.of(fresh));
        when(kakaoLocalClient.findNearby(anyString(), anyDouble(), anyDouble(), anyInt()))
                .thenReturn(List.of());

        PlaceKakaoInfoResponse response = service.getOrFetch(10L);

        assertThat(response.getRoadAddress()).isEqualTo("NEW road");
        assertThat(cached.getRoadAddress()).isEqualTo("NEW road");
        assertThat(cached.getLastSyncedAt()).isAfter(stale);
        // 새로 save 하지 않고 기존 엔티티만 update → JPA dirty checking 으로 flush.
        verify(kakaoPlaceInfoRepository, never()).save(any(KakaoPlaceInfo.class));
    }

    @Test
    @DisplayName("키 비활성: client.findPlace empty + 캐시도 없음 → available=false")
    void getOrFetch_disabledKeyAndNoCache_unavailable() {
        Place place = mockPlace(10L, "주문진 영진해변 방파제", 37.89, 128.83);
        when(placeRepository.findById(10L)).thenReturn(Optional.of(place));
        when(kakaoPlaceInfoRepository.findByPlaceId(10L)).thenReturn(Optional.empty());
        when(kakaoLocalClient.findPlace(anyString(), anyDouble(), anyDouble()))
                .thenReturn(Optional.empty());
        when(kakaoLocalClient.findNearby(anyString(), anyDouble(), anyDouble(), anyInt()))
                .thenReturn(List.of());

        PlaceKakaoInfoResponse response = service.getOrFetch(10L);

        assertThat(response.isAvailable()).isFalse();
        assertThat(response.getRoadAddress()).isNull();
        assertThat(response.getNearby()).isEmpty();
        verify(kakaoPlaceInfoRepository, never()).save(any(KakaoPlaceInfo.class));
    }

    @Test
    @DisplayName("키 비활성이지만 기존 캐시 있음 → 캐시 데이터로 응답, 외부 호출 결과 무시")
    void getOrFetch_disabledKeyWithExpiredCache_keepsCache() {
        Place place = mockPlace(10L, "주문진 영진해변 방파제", 37.89, 128.83);
        when(placeRepository.findById(10L)).thenReturn(Optional.of(place));

        Date stale = Date.from(Instant.now().minus(48, ChronoUnit.HOURS));
        KakaoPlaceInfo cached = KakaoPlaceInfo.builder()
                .place(place)
                .roadAddress("CACHED road")
                .lastSyncedAt(stale)
                .build();
        when(kakaoPlaceInfoRepository.findByPlaceId(10L)).thenReturn(Optional.of(cached));
        when(kakaoLocalClient.findPlace(anyString(), anyDouble(), anyDouble()))
                .thenReturn(Optional.empty());
        when(kakaoLocalClient.findNearby(anyString(), anyDouble(), anyDouble(), anyInt()))
                .thenReturn(List.of());

        PlaceKakaoInfoResponse response = service.getOrFetch(10L);

        assertThat(response.getRoadAddress()).isEqualTo("CACHED road");
        assertThat(response.isAvailable()).isTrue();
    }

    private static Place mockPlace(Long id, String name, double lat, double lng) {
        return Place.builder()
                .id(id)
                .name(name)
                .regionLabel("강릉시 주문진읍")
                .latitude(lat)
                .longitude(lng)
                .trendingScore(0)
                .photoCount(0)
                .likeCount(0)
                .rating(0)
                .reviewCount(0)
                .nearbyRestaurantCount(0)
                .build();
    }
}
