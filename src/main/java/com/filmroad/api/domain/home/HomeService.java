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
import com.filmroad.api.domain.work.WorkRepository;
import lombok.RequiredArgsConstructor;
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

    // Fallback center used when scope=NEAR is requested without a user location.
    // Keeping it explicit (and constant) avoids the prior silent-to-TRENDING quirk
    // that made the same scope return different data shapes depending on params.
    // Coordinates: 강릉 주문진 영진해변 (matches seed id=10, highest trending_score).
    static final double DEFAULT_LAT = 37.8928;
    static final double DEFAULT_LNG = 128.8347;

    private final PlaceRepository placeRepository;
    private final WorkRepository workRepository;
    private final PlaceLikeRepository placeLikeRepository;
    private final CurrentUser currentUser;

    @Transactional(readOnly = true)
    public HomeResponse getHome(Double lat, Double lng, Long workId, HomeScope scope) {
        HomeScope effectiveScope = scope == null ? HomeScope.NEAR : scope;

        List<Place> places;
        if (effectiveScope == HomeScope.NEAR) {
            // NEAR always means proximity sort. If the client omitted coordinates,
            // fall back to a default center instead of silently switching to TRENDING.
            double effectiveLat = lat != null ? lat : DEFAULT_LAT;
            double effectiveLng = lng != null ? lng : DEFAULT_LNG;
            // Sort entirely in-memory; dataset is small and DB-agnostic (MariaDB has no haversine built-in).
            places = placeRepository.findAllWithWork(workId).stream()
                    .sorted(Comparator.comparingDouble(p -> GeoUtils.haversineKm(effectiveLat, effectiveLng, p.getLatitude(), p.getLongitude())))
                    .limit(PLACE_LIMIT)
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

        HeroDto hero = buildHero(places);

        return HomeResponse.builder()
                .hero(hero)
                .works(workDtos)
                .places(placeDtos)
                .build();
    }

    private HeroDto buildHero(List<Place> places) {
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
        String subtitle = String.format("내 위치에서 차로 12분 · %d곳의 성지", sameWorkCount);

        return HeroDto.builder()
                .monthLabel(monthLabel)
                .tag("주말 추천")
                .title(title)
                .subtitle(subtitle)
                .workId(primary.getWork().getId())
                .primaryPlaceId(primary.getId())
                .build();
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

}
