package com.filmroad.api.domain.place;

import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.place.dto.NearbyRestaurantItem;
import com.filmroad.api.domain.place.dto.NearbyRestaurantsResponse;
import com.filmroad.api.integration.koreatourism.KoreaTourismClient;
import com.filmroad.api.integration.koreatourism.KoreaTourismItem;
import com.filmroad.api.integration.koreatourism.RegionCode;
import com.filmroad.api.integration.koreatourism.RegionCodeLookup;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 한국관광공사 API 프록시 — `GET /api/places/{id}/nearby-restaurants` 진입점.
 *
 * <h3>흐름</h3>
 * <ol>
 *   <li>placeId 로 Place 조회 (없으면 PLACE_NOT_FOUND 404)</li>
 *   <li>RegionCodeLookup 으로 (regionLabel, address) 둘 다 시도하여 시군구 코드 얻기 — null 가능</li>
 *   <li>KoreaTourismClient 호출 — 좌표 + (가능 시) regionCode</li>
 *   <li>외부 결과 → NearbyRestaurantItem 평탄 매핑</li>
 * </ol>
 *
 * <p>외부 API 실패/키 누락 → 빈 리스트 응답 (200). 프론트는 빈 리스트면 섹션을 가볍게 비표시.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NearbyRestaurantService {

    private final PlaceRepository placeRepository;
    private final KoreaTourismClient koreaTourismClient;
    private final RegionCodeLookup regionCodeLookup;

    @Transactional(readOnly = true)
    public NearbyRestaurantsResponse getNearbyRestaurants(Long placeId) {
        Place place = placeRepository.findById(placeId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.PLACE_NOT_FOUND));

        RegionCode code = regionCodeLookup
                .lookup(place.getRegionLabel(), place.getAddress())
                .orElse(null);

        List<KoreaTourismItem> raw = koreaTourismClient
                .findNearbyRestaurants(place.getLatitude(), place.getLongitude(), code);

        List<NearbyRestaurantItem> items = raw.stream()
                .map(NearbyRestaurantItem::from)
                .toList();

        return NearbyRestaurantsResponse.of(items);
    }
}
