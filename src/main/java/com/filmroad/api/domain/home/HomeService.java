package com.filmroad.api.domain.home;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.util.GeoUtils;
import com.filmroad.api.domain.home.dto.HeroDto;
import com.filmroad.api.domain.home.dto.HomeResponse;
import com.filmroad.api.domain.home.dto.PlaceSummaryDto;
import com.filmroad.api.domain.home.dto.WorkSummaryDto;
import com.filmroad.api.domain.like.PlaceLikeRepository;
import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceRepository;
import com.filmroad.api.domain.work.Work;
import com.filmroad.api.domain.work.WorkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class HomeService {

    private static final int PLACE_LIMIT = 20;
    // 홈 "인기 작품" 섹션 상한. 설계상 가로 스크롤 카드 5~8장 전후.
    private static final int POPULAR_WORK_LIMIT = 8;

    // Fallback center used when scope=NEAR is requested without a user location.
    // Keeping it explicit (and constant) avoids the prior silent-to-TRENDING quirk
    // that made the same scope return different data shapes depending on params.
    // Coordinates: 강릉 주문진 영진해변 (matches seed id=10, highest trending_score).
    static final double DEFAULT_LAT = 37.8928;
    static final double DEFAULT_LNG = 128.8347;

    // "내 위치 근처"의 기본 반경. 프런트에서 명시적으로 radiusKm 을 보내지 않으면
    // 이 값을 적용해 너무 먼 장소는 잘라낸다. 이전엔 정렬만 하고 전국 장소를 그대로
    // 돌려줘서 "가장 가까운 것이지만 200km 밖" 같은 결과가 섞여 있었음.
    static final double DEFAULT_RADIUS_KM = 30.0;

    private final PlaceRepository placeRepository;
    private final WorkRepository workRepository;
    private final PlaceLikeRepository placeLikeRepository;
    private final CurrentUser currentUser;

    @Transactional(readOnly = true)
    public HomeResponse getHome(Double lat, Double lng, Double radiusKm, Long workId, HomeScope scope) {
        HomeScope effectiveScope = scope == null ? HomeScope.NEAR : scope;

        List<Place> places;
        if (effectiveScope == HomeScope.NEAR) {
            // NEAR always means proximity sort. If the client omitted coordinates,
            // fall back to a default center instead of silently switching to TRENDING.
            double effectiveLat = lat != null ? lat : DEFAULT_LAT;
            double effectiveLng = lng != null ? lng : DEFAULT_LNG;
            // 반경을 넘어선 장소를 잘라내지 않으면 "가장 가까운 것" 이어도 수백km
            // 떨어져 있을 수 있다. radius 는 정렬 전에 적용 — 필드 두 번 계산하지
            // 않도록 (Place, 거리) 쌍으로 한 번에 처리.
            double effectiveRadius = radiusKm != null && radiusKm > 0 ? radiusKm : DEFAULT_RADIUS_KM;
            places = placeRepository.findAllWithWork(workId).stream()
                    .map(p -> new PlaceWithDistance(p, GeoUtils.haversineKm(effectiveLat, effectiveLng, p.getLatitude(), p.getLongitude())))
                    .filter(pd -> pd.distanceKm <= effectiveRadius)
                    .sorted(Comparator.comparingDouble(PlaceWithDistance::distanceKm))
                    .limit(PLACE_LIMIT)
                    .map(PlaceWithDistance::place)
                    .toList();
        } else {
            places = placeRepository.findTrending(workId).stream()
                    .limit(PLACE_LIMIT)
                    .toList();
        }

        List<Long> placeIds = places.stream().map(Place::getId).toList();
        Set<Long> likedPlaceIds = placeIds.isEmpty()
                ? Set.of()
                : new HashSet<>(placeLikeRepository.findPlaceIdsLikedByUser(currentUser.currentUserId(), placeIds));

        List<PlaceSummaryDto> placeDtos = places.stream()
                .map(p -> PlaceSummaryDto.from(p, likedPlaceIds.contains(p.getId())))
                .toList();

        List<WorkSummaryDto> workDtos = workRepository.findAll().stream()
                .sorted(Comparator.comparing(w -> w.getId()))
                .map(WorkSummaryDto::from)
                .toList();

        List<WorkSummaryDto> popularWorks = buildPopularWorks();

        // Hero 거리 표시는 사용자가 실제로 보낸 좌표가 있을 때만 — 폴백 센터로
        // 만든 가짜 거리 ("내 위치에서 약 12km" 같은) 를 보여주지 않기 위해
        // effectiveLat/Lng 가 아닌 원본 lat/lng 를 그대로 넘긴다.
        HeroDto hero = buildHero(places, lat, lng);

        return HomeResponse.builder()
                .hero(hero)
                .works(workDtos)
                .popularWorks(popularWorks)
                .places(placeDtos)
                .build();
    }

    private List<WorkSummaryDto> buildPopularWorks() {
        // trendingScore 합 DESC / placeCount DESC / title ASC 로 정렬된 튜플을 받아 DTO 로 매핑.
        return workRepository.findPopular(PageRequest.of(0, POPULAR_WORK_LIMIT)).stream()
                .map(row -> {
                    Work w = (Work) row[0];
                    int placeCount = ((Number) row[1]).intValue();
                    int trendingScore = ((Number) row[2]).intValue();
                    return WorkSummaryDto.popular(w, placeCount, trendingScore);
                })
                .toList();
    }

    private HeroDto buildHero(List<Place> places, Double userLat, Double userLng) {
        String monthLabel = LocalDate.now()
                .getMonth()
                .getDisplayName(java.time.format.TextStyle.SHORT, Locale.ENGLISH)
                .toUpperCase(Locale.ENGLISH);

        if (places.isEmpty()) {
            return HeroDto.builder()
                    .monthLabel(monthLabel)
                    .tag("주말 추천")
                    .title("오늘의 성지를 찾아보세요")
                    .subtitle("지금 인기 있는 촬영지를 둘러보세요")
                    .build();
        }

        Place primary = places.get(0);
        long sameWorkCount = places.stream()
                .filter(p -> p.getWork().getId().equals(primary.getWork().getId()))
                .count();

        String title = String.format("오늘은 '%s'의\n%s을 걸어볼까요?",
                primary.getWork().getTitle(),
                shortenRegion(primary.getRegionLabel()));
        String subtitle = buildHeroSubtitle(primary, sameWorkCount, userLat, userLng);

        return HeroDto.builder()
                .monthLabel(monthLabel)
                .tag("주말 추천")
                .title(title)
                .subtitle(subtitle)
                .workId(primary.getWork().getId())
                .primaryPlaceId(primary.getId())
                .build();
    }

    private String buildHeroSubtitle(Place primary, long sameWorkCount, Double userLat, Double userLng) {
        // 좌표가 모두 있을 때만 실제 haversine 거리 표시. 하나라도 없으면
        // "내 위치에서 약 N km" 같은 거짓 정보를 만들지 않고 중립 카피로 폴백.
        // (이전 버전은 좌표 유무와 무관하게 "차로 12분" 을 하드코딩해서
        // 부산 사용자가 강릉 hero 보면서 "12분" 을 보는 일이 있었음.)
        if (userLat != null && userLng != null
                && primary.getLatitude() != null && primary.getLongitude() != null) {
            double km = GeoUtils.haversineKm(userLat, userLng, primary.getLatitude(), primary.getLongitude());
            return String.format("내 위치에서 약 %s · %d곳의 성지", formatDistance(km), sameWorkCount);
        }
        return String.format("주변 %d곳의 성지", sameWorkCount);
    }

    private String formatDistance(double km) {
        // GPS 정확도와 haversine 자체의 직선거리 가정을 감안해 일부러 거칠게 표시.
        //  < 1km   → 100m 단위 ("800m")
        //  < 10km  → 소수 한 자리 ("3.4km")
        //  < 100km → 정수 ("23km")
        //  >= 100km → "100km+"
        if (km < 1.0) {
            int meters = (int) Math.round(km * 10) * 100;
            // 0m 로 떨어지는 극단 (사용자가 그 장소 위에 서 있는 경우) 은 100m 로 보정.
            if (meters <= 0) meters = 100;
            return meters + "m";
        }
        if (km < 10.0) {
            return String.format("%.1fkm", km);
        }
        if (km < 100.0) {
            return Math.round(km) + "km";
        }
        return "100km+";
    }

    private String shortenRegion(String regionLabel) {
        // "강릉시 주문진읍" -> "주문진" for a punchier hero headline.
        if (regionLabel == null || regionLabel.isBlank()) {
            return "";
        }
        String[] parts = regionLabel.trim().split("\\s+");
        String last = parts[parts.length - 1];
        if (last.endsWith("읍") || last.endsWith("면") || last.endsWith("동")) {
            return last.substring(0, last.length() - 1);
        }
        return last;
    }

    // (Place, haversine distance) 쌍 — 스트림에서 거리 중복 계산을 피하기 위한 내부 record.
    private record PlaceWithDistance(Place place, double distanceKm) {}

}
