package com.filmroad.api.domain.saved;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.common.util.GeoUtils;
import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceRepository;
import com.filmroad.api.domain.saved.dto.CollectionSummaryDto;
import com.filmroad.api.domain.saved.dto.RouteSuggestionDto;
import com.filmroad.api.domain.saved.dto.SavedItemDto;
import com.filmroad.api.domain.saved.dto.SavedResponse;
import com.filmroad.api.domain.saved.dto.ToggleSaveResponse;
import com.filmroad.api.domain.stamp.StampRepository;
import com.filmroad.api.domain.user.User;
import com.filmroad.api.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SavedService {

    private static final double NEARBY_RADIUS_KM = 30.0;

    private final SavedPlaceRepository savedPlaceRepository;
    private final CollectionRepository collectionRepository;
    private final PlaceRepository placeRepository;
    private final StampRepository stampRepository;
    private final UserRepository userRepository;
    private final CurrentUser currentUser;

    @Transactional(readOnly = true)
    public SavedResponse getSaved(Double lat, Double lng) {
        Long userId = currentUser.currentUserId();
        List<Collection> collections = collectionRepository.findByUserIdOrderByCreatedAtAsc(userId);
        List<SavedPlace> savedPlaces = savedPlaceRepository.findByUserIdOrderByCreatedAtDesc(userId);

        Map<Long, Place> placeById = new HashMap<>();
        for (SavedPlace sp : savedPlaces) {
            placeById.put(sp.getPlace().getId(), sp.getPlace());
        }

        List<CollectionSummaryDto> collectionDtos = collections.stream()
                .map(c -> {
                    Place cover = c.getCoverPlaceId() == null ? null : placeById.get(c.getCoverPlaceId());
                    if (cover == null && c.getCoverPlaceId() != null) {
                        cover = placeRepository.findById(c.getCoverPlaceId()).orElse(null);
                    }
                    return CollectionSummaryDto.builder()
                            .id(c.getId())
                            .name(c.getName())
                            .count(collectionRepository.countSavedByCollectionId(c.getId()))
                            .coverImageUrl(cover == null ? null : cover.getCoverImageUrl())
                            .gradient(c.getGradient())
                            .build();
                })
                .toList();

        List<SavedItemDto> items = savedPlaces.stream()
                .map(sp -> {
                    Place p = sp.getPlace();
                    Double distance = GeoUtils.distanceKmOrNull(lat, lng, p.getLatitude(), p.getLongitude());
                    return SavedItemDto.builder()
                            .placeId(p.getId())
                            .name(p.getName())
                            .regionLabel(p.getRegionLabel())
                            .coverImageUrl(p.getCoverImageUrl())
                            .workId(p.getWork().getId())
                            .workTitle(p.getWork().getTitle())
                            .distanceKm(distance)
                            .likeCount(p.getLikeCount())
                            .visited(stampRepository.existsByUserIdAndPlaceId(userId, p.getId()))
                            .collectionId(sp.getCollection() == null ? null : sp.getCollection().getId())
                            .build();
                })
                .toList();

        RouteSuggestionDto suggestion = null;
        if (lat != null && lng != null) {
            long nearbyCount = items.stream()
                    .filter(i -> i.getDistanceKm() != null && i.getDistanceKm() <= NEARBY_RADIUS_KM)
                    .count();
            if (nearbyCount >= 2) {
                suggestion = RouteSuggestionDto.builder()
                        .title("근처 성지 " + nearbyCount + "곳, 하루에 돌 수 있어요")
                        .subtitle("AI가 자동으로 루트를 짜드려요")
                        .placeCount((int) nearbyCount)
                        .build();
            }
        }

        return SavedResponse.builder()
                .collections(collectionDtos)
                .totalCount(items.size())
                .items(items)
                .nearbyRouteSuggestion(suggestion)
                .build();
    }

    @Transactional
    public ToggleSaveResponse toggleSave(Long placeId) {
        Long userId = currentUser.currentUserId();
        boolean saved;
        if (savedPlaceRepository.existsByUserIdAndPlaceId(userId, placeId)) {
            savedPlaceRepository.deleteByUserIdAndPlaceId(userId, placeId);
            saved = false;
        } else {
            Place place = placeRepository.findById(placeId)
                    .orElseThrow(() -> BaseException.of(BaseResponseStatus.PLACE_NOT_FOUND));
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> BaseException.of(BaseResponseStatus.RESPONSE_NULL_ERROR));
            savedPlaceRepository.save(SavedPlace.builder()
                    .user(user)
                    .place(place)
                    .collection(null)
                    .build());
            saved = true;
        }
        return ToggleSaveResponse.builder()
                .saved(saved)
                .totalCount(savedPlaceRepository.countByUserId(userId))
                .build();
    }
}
