package com.filmroad.api.domain.map;

import com.filmroad.api.common.util.GeoUtils;
import com.filmroad.api.domain.map.dto.MapMarkerDto;
import com.filmroad.api.domain.map.dto.MapResponse;
import com.filmroad.api.domain.map.dto.PlaceDetailDto;
import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MapService {

    private static final int MARKER_LIMIT = 60;

    private final PlaceRepository placeRepository;

    @Transactional(readOnly = true)
    public MapResponse getMap(Double lat, Double lng, Long workId, String q, Long selectedId) {
        String normalizedQ = (q == null || q.isBlank()) ? null : q.trim();

        List<Place> places = placeRepository.searchForMap(workId, normalizedQ).stream()
                .limit(MARKER_LIMIT)
                .toList();

        List<MapMarkerDto> markers = places.stream()
                .map(p -> MapMarkerDto.of(p, distanceKm(lat, lng, p)))
                .toList();

        PlaceDetailDto selected = resolveSelected(places, selectedId, lat, lng);

        return MapResponse.builder()
                .markers(markers)
                .selected(selected)
                .build();
    }

    private PlaceDetailDto resolveSelected(List<Place> visiblePlaces, Long selectedId, Double lat, Double lng) {
        // Prefer the explicit selection when it's in the filtered set; otherwise default
        // to the most prominent marker so the bottom sheet is never empty.
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
        return chosen == null ? null : PlaceDetailDto.of(chosen, distanceKm(lat, lng, chosen));
    }

    private static Double distanceKm(Double lat, Double lng, Place place) {
        return GeoUtils.distanceKmOrNull(lat, lng, place.getLatitude(), place.getLongitude());
    }
}
