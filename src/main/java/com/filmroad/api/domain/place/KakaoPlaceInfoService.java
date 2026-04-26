package com.filmroad.api.domain.place;

import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.place.dto.KakaoNearbyDto;
import com.filmroad.api.domain.place.dto.PlaceKakaoInfoResponse;
import com.filmroad.api.integration.kakao.KakaoLocalClient;
import com.filmroad.api.integration.kakao.KakaoLocalProperties;
import com.filmroad.api.integration.kakao.KakaoLocalResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Optional;

/**
 * 장소의 카카오맵 메타데이터(주소/전화/카테고리/URL) 조회 + 주변 맛집·카페 검색.
 *
 * <p>캐시 전략:
 * <ul>
 *   <li>장소 자체 정보는 {@link KakaoPlaceInfo} 1:1 테이블에 캐시. TTL 안이면 외부 호출 X.</li>
 *   <li>주변 맛집/카페는 캐시하지 않음 — 사용자별로 거리 정렬이 의미 있고 데이터가 자주 바뀌므로
 *       매 요청 두 카테고리 호출. 키 비활성/장애 시 빈 리스트.</li>
 * </ul>
 *
 * <p>응답의 {@code available} 은 "프론트가 섹션을 그릴 가치가 있는가" 신호. 카카오에서 받은
 * 핵심 필드(주소/전화/카테고리/URL) 중 최소 하나라도 있거나 주변 결과가 1개 이상이면 true.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KakaoPlaceInfoService {

    private static final String CATEGORY_RESTAURANT = "FD6";
    private static final String CATEGORY_CAFE = "CE7";

    private final PlaceRepository placeRepository;
    private final KakaoPlaceInfoRepository kakaoPlaceInfoRepository;
    private final KakaoLocalClient kakaoLocalClient;
    private final KakaoLocalProperties properties;

    @Transactional
    public PlaceKakaoInfoResponse getOrFetch(Long placeId) {
        Place place = placeRepository.findById(placeId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.PLACE_NOT_FOUND));

        KakaoPlaceInfo info = resolveInfo(place);
        List<KakaoNearbyDto> nearby = fetchNearby(place);

        boolean available = hasMeaningfulData(info, nearby);

        return PlaceKakaoInfoResponse.builder()
                .roadAddress(info != null ? info.getRoadAddress() : null)
                .jibunAddress(info != null ? info.getJibunAddress() : null)
                .phone(info != null ? info.getPhone() : null)
                .category(info != null ? info.getCategory() : null)
                .kakaoPlaceUrl(info != null ? info.getKakaoPlaceUrl() : null)
                .lastSyncedAt(info != null ? info.getLastSyncedAt() : null)
                .nearby(nearby)
                .available(available)
                .build();
    }

    /**
     * 캐시 hit (TTL 안) → 그대로. miss/expired → 외부 호출 후 upsert.
     * 외부 호출이 빈 결과여도 기존 캐시가 있으면 그걸 보존(키 비활성 시 stale-but-better-than-nothing).
     */
    private KakaoPlaceInfo resolveInfo(Place place) {
        Optional<KakaoPlaceInfo> cachedOpt = kakaoPlaceInfoRepository.findByPlaceId(place.getId());

        if (cachedOpt.isPresent() && isFresh(cachedOpt.get())) {
            return cachedOpt.get();
        }

        Optional<KakaoLocalResult> fetched = kakaoLocalClient
                .findPlace(place.getName(), place.getLatitude(), place.getLongitude());

        if (fetched.isEmpty()) {
            // 외부 결과 없음 — 기존 캐시(있다면) 그대로 사용. 없으면 null.
            return cachedOpt.orElse(null);
        }

        KakaoLocalResult result = fetched.get();
        Date now = Date.from(Instant.now());

        if (cachedOpt.isPresent()) {
            KakaoPlaceInfo existing = cachedOpt.get();
            existing.update(
                    result.roadAddress(),
                    result.jibunAddress(),
                    result.phone(),
                    result.categoryName(),
                    result.placeUrl(),
                    now
            );
            return existing;
        }

        KakaoPlaceInfo created = KakaoPlaceInfo.builder()
                .place(place)
                .roadAddress(result.roadAddress())
                .jibunAddress(result.jibunAddress())
                .phone(result.phone())
                .category(result.categoryName())
                .kakaoPlaceUrl(result.placeUrl())
                .lastSyncedAt(now)
                .build();
        return kakaoPlaceInfoRepository.save(created);
    }

    private boolean isFresh(KakaoPlaceInfo info) {
        if (info.getLastSyncedAt() == null) return false;
        int ttlHours = properties.local() != null ? properties.local().cacheTtlHours() : 24;
        Duration age = Duration.between(info.getLastSyncedAt().toInstant(), Instant.now());
        return age.toHours() < ttlHours;
    }

    private List<KakaoNearbyDto> fetchNearby(Place place) {
        int radius = properties.local() != null ? properties.local().nearbyRadiusMeters() : 500;

        List<KakaoLocalResult> restaurants = kakaoLocalClient
                .findNearby(CATEGORY_RESTAURANT, place.getLatitude(), place.getLongitude(), radius);
        List<KakaoLocalResult> cafes = kakaoLocalClient
                .findNearby(CATEGORY_CAFE, place.getLatitude(), place.getLongitude(), radius);

        List<KakaoNearbyDto> merged = new ArrayList<>(restaurants.size() + cafes.size());
        restaurants.stream().map(KakaoNearbyDto::from).forEach(merged::add);
        cafes.stream().map(KakaoNearbyDto::from).forEach(merged::add);
        merged.sort(Comparator.comparingInt(KakaoNearbyDto::getDistanceMeters));
        return merged;
    }

    private static boolean hasMeaningfulData(KakaoPlaceInfo info, List<KakaoNearbyDto> nearby) {
        if (info != null) {
            if (notBlank(info.getRoadAddress())
                    || notBlank(info.getJibunAddress())
                    || notBlank(info.getPhone())
                    || notBlank(info.getCategory())
                    || notBlank(info.getKakaoPlaceUrl())) {
                return true;
            }
        }
        return nearby != null && !nearby.isEmpty();
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
