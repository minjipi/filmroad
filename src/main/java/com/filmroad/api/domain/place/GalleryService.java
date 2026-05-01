package com.filmroad.api.domain.place;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.like.PhotoLikeRepository;
import com.filmroad.api.domain.place.dto.GalleryPhotoDto;
import com.filmroad.api.domain.place.dto.GalleryPlaceHeaderDto;
import com.filmroad.api.domain.place.dto.PlacePhotoPageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class GalleryService {

    private static final int DEFAULT_SIZE = 20;

    private final PlacePhotoRepository placePhotoRepository;
    private final PlaceRepository placeRepository;
    private final PhotoLikeRepository photoLikeRepository;
    private final CurrentUser currentUser;

    @Transactional(readOnly = true)
    public PlacePhotoPageResponse getPhotos(Long placeId, String sort, int page, int size) {
        Place place = placeRepository.findById(placeId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.PLACE_NOT_FOUND));

        int safeSize = size <= 0 ? DEFAULT_SIZE : Math.min(size, 50);
        int safePage = Math.max(0, page);
        String normalizedSort = normalizeSort(sort);
        Pageable pageable = PageRequest.of(safePage, safeSize);
        // 비로그인 viewer 는 viewerId=null 로 PUBLIC 만 보이게. JPQL 의 visibility 절이
        // null 을 받으면 본인/FOLLOWERS 분기가 모두 false 가 되어 PUBLIC 만 통과한다.
        Long viewerId = currentUser.currentUserIdOrNull();

        // PRIVATE/FOLLOWERS 필터를 DB 레벨에서 적용해 pagination 정합성을 유지 (in-memory 필터는 페이지 size 가 깨짐).
        Page<PlacePhoto> photoPage = switch (normalizedSort) {
            case "POPULAR" -> placePhotoRepository
                    .findByPlaceIdOrderByOrderIndexDescIdDesc(placeId, viewerId, pageable);
            default -> placePhotoRepository
                    .findByPlaceIdOrderByCreatedAtDesc(placeId, viewerId, pageable);
        };

        GalleryPlaceHeaderDto header = GalleryPlaceHeaderDto.builder()
                .placeId(place.getId())
                .name(place.getName())
                .contentTitle(place.getContent().getTitle())
                .contentEpisode(place.getPrimaryContentEpisode())
                .totalPhotoCount(placePhotoRepository.countByPlaceId(placeId))
                .build();

        // 비로그인 (viewerId == null) 또는 빈 페이지 → 외부 호출 없이 빈 셋.
        // 로그인 + photoIds 가 있을 때만 1회 batch 쿼리로 좋아요 여부 한 번에 조회.
        Set<Long> likedIds = (viewerId == null || photoPage.getContent().isEmpty())
                ? Set.of()
                : new HashSet<>(photoLikeRepository.findPhotoIdsLikedByUser(
                        viewerId,
                        photoPage.getContent().stream().map(PlacePhoto::getId).toList()));

        List<GalleryPhotoDto> photoDtos = photoPage.getContent().stream()
                .map(p -> GalleryPhotoDto.from(p, likedIds.contains(p.getId())))
                .toList();

        return PlacePhotoPageResponse.builder()
                .place(header)
                .photos(photoDtos)
                .total(photoPage.getTotalElements())
                .page(safePage)
                .size(safeSize)
                .sort(normalizedSort)
                .build();
    }

    private String normalizeSort(String sort) {
        if (sort == null || sort.isBlank()) return "RECENT";
        String upper = sort.trim().toUpperCase();
        // SCENE_COMPARE 는 현재 데이터 모델로 구분 불가 → RECENT fallback.
        // (FRIENDS 키는 프런트에서 제거돼 더이상 들어오지 않음.)
        return switch (upper) {
            case "POPULAR" -> "POPULAR";
            case "RECENT", "SCENE_COMPARE" -> "RECENT";
            default -> "RECENT";
        };
    }
}
