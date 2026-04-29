package com.filmroad.api.domain.place;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.place.dto.GalleryPhotoDto;
import com.filmroad.api.domain.place.dto.GalleryPlaceHeaderDto;
import com.filmroad.api.domain.place.dto.PlacePhotoPageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GalleryService {

    private static final int DEFAULT_SIZE = 20;

    private final PlacePhotoRepository placePhotoRepository;
    private final PlaceRepository placeRepository;
    private final CurrentUser currentUser;

    @Transactional(readOnly = true)
    public PlacePhotoPageResponse getPhotos(Long placeId, String sort, int page, int size) {
        Place place = placeRepository.findById(placeId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.PLACE_NOT_FOUND));

        int safeSize = size <= 0 ? DEFAULT_SIZE : Math.min(size, 50);
        int safePage = Math.max(0, page);
        String normalizedSort = normalizeSort(sort);
        Pageable pageable = PageRequest.of(safePage, safeSize);
        Long viewerId = currentUser.currentUserId();

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
                .workTitle(place.getWork().getTitle())
                .workEpisode(place.getPrimaryWorkEpisode())
                .totalPhotoCount(placePhotoRepository.countByPlaceId(placeId))
                .build();

        return PlacePhotoPageResponse.builder()
                .place(header)
                .photos(photoPage.getContent().stream().map(GalleryPhotoDto::from).toList())
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
