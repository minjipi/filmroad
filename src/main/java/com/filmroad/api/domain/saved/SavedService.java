package com.filmroad.api.domain.saved;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.common.util.GeoUtils;
import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceCoverImage;
import com.filmroad.api.domain.place.PlacePhotoRepository;
import com.filmroad.api.domain.place.PlaceRepository;
import com.filmroad.api.domain.saved.dto.CollectionDetailResponse;
import com.filmroad.api.domain.saved.dto.CollectionItemDto;
import com.filmroad.api.domain.saved.dto.CollectionOwnerDto;
import com.filmroad.api.domain.saved.dto.CollectionSummaryDto;
import com.filmroad.api.domain.saved.dto.RouteSuggestionDto;
import com.filmroad.api.domain.saved.dto.SavedItemDto;
import com.filmroad.api.domain.saved.dto.SavedResponse;
import com.filmroad.api.domain.saved.dto.ToggleSaveResponse;
import com.filmroad.api.domain.stamp.Stamp;
import com.filmroad.api.domain.stamp.StampRepository;
import com.filmroad.api.domain.user.User;
import com.filmroad.api.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class SavedService {

    private static final double NEARBY_RADIUS_KM = 30.0;

    private final SavedPlaceRepository savedPlaceRepository;
    private final CollectionRepository collectionRepository;
    private final PlaceRepository placeRepository;
    private final PlacePhotoRepository placePhotoRepository;
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
                            .coverImageUrls(cover == null ? null : toCoverImageUrls(cover))
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
                            .coverImageUrls(toCoverImageUrls(p))
                            .contentId(p.getContent().getId())
                            .contentTitle(p.getContent().getTitle())
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

    /**
     * 컬렉션 상세. 소유자 검증(404 enumeration 방지), route 순서(저장시각 ASC) 정렬, 방문/인증 상태 일괄 조회.
     * lat/lng 가 있으면 items.distanceKm 채워 내려준다.
     */
    @Transactional(readOnly = true)
    public CollectionDetailResponse getCollectionDetail(Long collectionId, Double lat, Double lng) {
        Long userId = currentUser.currentUserId();
        Collection collection = collectionRepository.findById(collectionId)
                .filter(c -> c.getUser().getId().equals(userId))
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.COLLECTION_NOT_FOUND));

        List<SavedPlace> savedPlaces = savedPlaceRepository
                .findByCollectionIdOrderByCreatedAtAsc(collectionId);
        List<Long> placeIds = savedPlaces.stream().map(sp -> sp.getPlace().getId()).toList();

        Map<Long, Date> visitedAtByPlace = new HashMap<>();
        Set<Long> certifiedPlaceIds = new HashSet<>();
        if (!placeIds.isEmpty()) {
            for (Stamp s : stampRepository.findByUserIdAndPlaceIdIn(userId, placeIds)) {
                visitedAtByPlace.put(s.getPlace().getId(), s.getAcquiredAt());
            }
            certifiedPlaceIds.addAll(
                    placePhotoRepository.findDistinctPlaceIdsByUserIdAndPlaceIdIn(userId, placeIds));
        }

        List<CollectionItemDto> items = new ArrayList<>();
        long totalLikeCount = 0;
        double estimatedRouteKm = 0;
        Double prevLat = null, prevLng = null;
        Set<Long> distinctContentIds = new HashSet<>();

        int idx = 0;
        for (SavedPlace sp : savedPlaces) {
            idx++;
            Place p = sp.getPlace();
            Date visitedAt = visitedAtByPlace.get(p.getId());
            totalLikeCount += p.getLikeCount();
            distinctContentIds.add(p.getContent().getId());
            if (prevLat != null) {
                estimatedRouteKm += GeoUtils.haversineKm(
                        prevLat, prevLng, p.getLatitude(), p.getLongitude());
            }
            prevLat = p.getLatitude();
            prevLng = p.getLongitude();

            items.add(CollectionItemDto.builder()
                    .id(p.getId())
                    .orderIndex(idx)
                    .name(p.getName())
                    .regionLabel(p.getRegionLabel())
                    .coverImageUrl(p.getPrimaryCoverImageUrl())
                    .latitude(p.getLatitude())
                    .longitude(p.getLongitude())
                    .contentId(p.getContent().getId())
                    .contentTitle(p.getContent().getTitle())
                    .contentEpisode(formatContentEpisode(p.getPrimaryContentEpisode(), p.getPrimarySceneTimestamp()))
                    .likeCount(p.getLikeCount())
                    .photoCount(p.getPhotoCount())
                    .distanceKm(GeoUtils.distanceKmOrNull(lat, lng, p.getLatitude(), p.getLongitude()))
                    .visited(visitedAt != null)
                    .visitedAt(visitedAt)
                    .certified(certifiedPlaceIds.contains(p.getId()))
                    .build());
        }

        // upcoming / visited 섹션 분리. 원래 route 순서(orderIndex ASC) 그대로 유지.
        List<CollectionItemDto> upcomingPlaces = items.stream()
                .filter(i -> !i.isVisited())
                .toList();
        List<CollectionItemDto> visitedPlacesList = items.stream()
                .filter(CollectionItemDto::isVisited)
                .toList();

        int totalPlaces = items.size();
        int visitedCount = visitedPlacesList.size();
        int certifiedCount = (int) items.stream().filter(CollectionItemDto::isCertified).count();

        // kind/contentTitle: 수록 place 들이 모두 같은 작품이면 WORK, 아니면 CUSTOM.
        String kind = (distinctContentIds.size() == 1 && totalPlaces > 0) ? "CONTENT" : "CUSTOM";
        String contentTitle = "CONTENT".equals(kind) ? items.get(0).getContentTitle() : null;

        String coverImageUrl = null;
        if (collection.getCoverPlaceId() != null) {
            coverImageUrl = placeRepository.findById(collection.getCoverPlaceId())
                    .map(Place::getPrimaryCoverImageUrl)
                    .orElse(null);
        }
        if (coverImageUrl == null && !items.isEmpty()) {
            coverImageUrl = items.get(0).getCoverImageUrl();
        }

        User owner = collection.getUser();
        CollectionOwnerDto ownerDto = CollectionOwnerDto.builder()
                .id(owner.getId())
                .nickname(owner.getNickname())
                .avatarUrl(owner.getAvatarUrl())
                .isMe(owner.getId().equals(userId))
                .build();

        // totalDistanceKm: place 가 2개 미만이면 경로 계산 의미 없음 → null.
        Double totalDistanceKm = totalPlaces >= 2
                ? Math.round(estimatedRouteKm * 10.0) / 10.0
                : null;

        return CollectionDetailResponse.builder()
                .id(collection.getId())
                .name(collection.getName())
                .subtitle(collection.getDescription())
                .coverImageUrl(coverImageUrl)
                .kind(kind)
                .contentTitle(contentTitle)
                .createdAt(collection.getCreatedAt())
                .totalPlaces(totalPlaces)
                .visitedPlaces(visitedCount)
                .certifiedPlaces(certifiedCount)
                .totalDistanceKm(totalDistanceKm)
                .likeCount(totalLikeCount)
                .owner(ownerDto)
                .privacy("PRIVATE")
                .upcomingPlaces(upcomingPlaces)
                .visitedPlacesList(visitedPlacesList)
                .build();
    }

    /**
     * place 의 primary scene contentEpisode / sceneTimestamp 를 "1회 00:15:24" 형태로 결합. 둘 다 없으면 null.
     */
    private static String formatContentEpisode(String episode, String timestamp) {
        boolean hasEp = episode != null && !episode.isBlank();
        boolean hasTs = timestamp != null && !timestamp.isBlank();
        if (!hasEp && !hasTs) return null;
        if (hasEp && hasTs) return episode + " " + timestamp;
        return hasEp ? episode : timestamp;
    }

    @Transactional
    public CollectionSummaryDto createCollection(String rawName) {
        String name = normalizeName(rawName);
        Long userId = currentUser.currentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.RESPONSE_NULL_ERROR));

        Collection saved = collectionRepository.save(Collection.builder()
                .user(user)
                .name(name)
                .build());

        // 새 컬렉션은 항상 saved place 0개 — count 쿼리 없이 바로 0 으로 내려보낸다.
        return CollectionSummaryDto.builder()
                .id(saved.getId())
                .name(saved.getName())
                .count(0L)
                .coverImageUrls(null)
                .gradient(saved.getGradient())
                .build();
    }

    @Transactional
    public CollectionSummaryDto renameCollection(Long collectionId, String rawName) {
        String name = normalizeName(rawName);
        Long userId = currentUser.currentUserId();
        Collection collection = collectionRepository.findById(collectionId)
                .filter(c -> c.getUser().getId().equals(userId))
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.COLLECTION_NOT_FOUND));
        collection.rename(name);
        return CollectionSummaryDto.builder()
                .id(collection.getId())
                .name(collection.getName())
                .count(collectionRepository.countSavedByCollectionId(collection.getId()))
                .coverImageUrls(null)
                .gradient(collection.getGradient())
                .build();
    }

    /**
     * 컬렉션 삭제. 안에 든 SavedPlace 까지 같이 삭제 (Phase 1 정책: 저장 자체 해제).
     * 다른 컬렉션에도 같은 장소가 있을 가능성은 현재 데이터모델상 0 — SavedPlace 는 (user,place) 유니크.
     */
    @Transactional
    public void deleteCollection(Long collectionId) {
        Long userId = currentUser.currentUserId();
        Collection collection = collectionRepository.findById(collectionId)
                .filter(c -> c.getUser().getId().equals(userId))
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.COLLECTION_NOT_FOUND));
        savedPlaceRepository.deleteByCollectionId(collection.getId());
        collectionRepository.delete(collection);
    }

    /**
     * Create / rename 공통 검증 — trim, 공백/길이 (서비스 단 방어, @Valid 우회 경로 대비).
     */
    private String normalizeName(String rawName) {
        String name = rawName == null ? "" : rawName.trim();
        if (name.isEmpty()) {
            throw new BaseException(BaseResponseStatus.REQUEST_ERROR, "컬렉션 이름을 입력해주세요.");
        }
        if (name.length() > 20) {
            throw new BaseException(BaseResponseStatus.REQUEST_ERROR, "컬렉션 이름은 20자 이하로 입력해주세요.");
        }
        return name;
    }

    @Transactional
    public ToggleSaveResponse toggleSave(Long placeId, Long collectionId) {
        Long userId = currentUser.currentUserId();
        boolean saved;
        if (savedPlaceRepository.existsByUserIdAndPlaceId(userId, placeId)) {
            // unsave 경로: collectionId 는 의미 없음(어느 컬렉션에 있든 전부 제거).
            savedPlaceRepository.deleteByUserIdAndPlaceId(userId, placeId);
            saved = false;
        } else {
            Place place = placeRepository.findById(placeId)
                    .orElseThrow(() -> BaseException.of(BaseResponseStatus.PLACE_NOT_FOUND));
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> BaseException.of(BaseResponseStatus.RESPONSE_NULL_ERROR));
            Collection collection = resolveOwnedCollection(collectionId, userId);
            savedPlaceRepository.save(SavedPlace.builder()
                    .user(user)
                    .place(place)
                    .collection(collection)
                    .build());
            saved = true;
        }
        return ToggleSaveResponse.builder()
                .saved(saved)
                .totalCount(savedPlaceRepository.countByUserId(userId))
                .build();
    }

    /**
     * Place.coverImages → List<String> 매핑 헬퍼. 비어 있으면 빈 리스트.
     */
    private static List<String> toCoverImageUrls(Place place) {
        return place.getCoverImages().stream().map(PlaceCoverImage::getImageUrl).toList();
    }

    /**
     * collectionId 가 있으면 소유주 일치까지 확인해서 Collection 반환. null 이면 기본(미할당).
     * 존재하지 않거나 남의 컬렉션이면 존재 유무를 굳이 구분하지 않고 동일 에러(404)로 돌려 enumeration 방지.
     */
    private Collection resolveOwnedCollection(Long collectionId, Long userId) {
        if (collectionId == null) {
            return null;
        }
        return collectionRepository.findById(collectionId)
                .filter(c -> c.getUser().getId().equals(userId))
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.COLLECTION_NOT_FOUND));
    }
}
