package com.filmroad.api.domain.map;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.common.util.GeoUtils;
import com.filmroad.api.domain.like.PlaceLikeRepository;
import com.filmroad.api.domain.map.dto.MapMarkerDto;
import com.filmroad.api.domain.map.dto.MapResponse;
import com.filmroad.api.domain.map.dto.PlaceDetailDto;
import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MapService {

    /**
     * bbox 활성 뷰의 상한. viewport 자체가 자연스러운 범위 제한이므로 크게 두어
     * "지방으로 이동하면 장소가 안 보인다" 증상을 피한다. 클라이언트 클러스터링이 감당하는 대략적 상한.
     */
    @Value("${app.map.bounded-marker-limit:2000}")
    private int boundedMarkerLimit;

    /**
     * 전국 뷰(bbox 없음)의 상한. trendingScore 기준 상위 N개만 내려 보내 인기 장소 프리뷰 용도.
     */
    @Value("${app.map.nationwide-marker-limit:500}")
    private int nationwideMarkerLimit;

    private final PlaceRepository placeRepository;
    private final PlaceLikeRepository placeLikeRepository;
    private final CurrentUser currentUser;

    @Transactional(readOnly = true)
    public MapResponse getMap(Double lat, Double lng, Long contentId, String q, Long selectedId,
                              Double swLat, Double swLng, Double neLat, Double neLng) {
        String normalizedQ = (q == null || q.isBlank()) ? null : q.trim();
        Bounds bounds = Bounds.ofNullable(swLat, swLng, neLat, neLng);

        List<Place> places = fetchPlaces(contentId, normalizedQ, bounds);

        List<MapMarkerDto> markers = places.stream()
                .map(p -> MapMarkerDto.of(p, distanceKm(lat, lng, p)))
                .toList();

        PlaceDetailDto selected = resolveSelected(places, selectedId, lat, lng);

        return MapResponse.builder()
                .markers(markers)
                .selected(selected)
                .build();
    }

    private List<Place> fetchPlaces(Long contentId, String q, Bounds bounds) {
        if (bounds.active()) {
            // bbox 경로: trendingScore 정렬 없이 id ASC, 넉넉한 limit 으로 viewport 내 장소 전수 반환.
            return placeRepository.findInBoundsForMap(
                            contentId, q, bounds.swLat(), bounds.swLng(), bounds.neLat(), bounds.neLng())
                    .stream()
                    .limit(boundedMarkerLimit)
                    .toList();
        }
        // 전국 경로: 인기 장소 상위 N개만.
        return placeRepository.searchForMap(contentId, q).stream()
                .limit(nationwideMarkerLimit)
                .toList();
    }

    private PlaceDetailDto resolveSelected(List<Place> visiblePlaces, Long selectedId, Double lat, Double lng) {
        // selected 는 bbox 밖이어도 딥링크로 들어온 장소일 수 있어 findById 로 fallback 로드.
        Place chosen = null;
        if (selectedId != null) {
            chosen = visiblePlaces.stream()
                    .filter(p -> p.getId().equals(selectedId))
                    .findFirst()
                    .orElse(null);
            if (chosen == null) {
                chosen = placeRepository.findById(selectedId).orElse(null);
            }
        }
        if (chosen == null && !visiblePlaces.isEmpty()) {
            chosen = visiblePlaces.get(0);
        }
        if (chosen == null) {
            return null;
        }
        // viewer 의 좋아요 여부 — 비로그인은 false. 단일 place 라 한 번의 exists 쿼리로 충분.
        Long viewerId = currentUser.currentUserIdOrNull();
        boolean liked = viewerId != null
                && placeLikeRepository.existsByUserIdAndPlaceId(viewerId, chosen.getId());
        return PlaceDetailDto.of(chosen, distanceKm(lat, lng, chosen), liked);
    }

    private static Double distanceKm(Double lat, Double lng, Place place) {
        return GeoUtils.distanceKmOrNull(lat, lng, place.getLatitude(), place.getLongitude());
    }

    /**
     * bbox 파라미터 4개를 묶어 유효성 검사. 넷 다 있어야 bbox 활성, 부분 제공은 조용히 무시
     * (좌표가 하나만 찍혀도 엔드포인트가 죽으면 UX 가 나빠지므로). sw/ne 역순은 400.
     */
    record Bounds(Double swLat, Double swLng, Double neLat, Double neLng) {
        static Bounds ofNullable(Double swLat, Double swLng, Double neLat, Double neLng) {
            boolean allPresent = swLat != null && swLng != null && neLat != null && neLng != null;
            if (!allPresent) {
                return new Bounds(null, null, null, null);
            }
            if (swLat > neLat || swLng > neLng) {
                throw new BaseException(BaseResponseStatus.REQUEST_ERROR,
                        "지도 영역 좌표 순서가 잘못되었습니다. (sw 는 ne 보다 작아야 합니다.)");
            }
            return new Bounds(swLat, swLng, neLat, neLng);
        }

        boolean active() {
            return swLat != null && swLng != null && neLat != null && neLng != null;
        }
    }
}
