package com.filmroad.api.domain.place;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.common.util.GeoUtils;
import com.filmroad.api.domain.like.PlaceLikeRepository;
import com.filmroad.api.domain.place.dto.PlaceDetailResponse;
import com.filmroad.api.domain.place.dto.PlaceFullDto;
import com.filmroad.api.domain.place.dto.PlacePhotoDto;
import com.filmroad.api.domain.place.dto.RelatedPlaceDto;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PlaceDetailService {

    private static final int PHOTO_LIMIT = 6;
    private static final int RELATED_LIMIT = 6;
    private static final double AVERAGE_DRIVE_SPEED_KMH = 40.0;

    private final PlaceRepository placeRepository;
    private final PlacePhotoRepository placePhotoRepository;
    private final PlaceLikeRepository placeLikeRepository;
    private final CurrentUser currentUser;

    @Transactional(readOnly = true)
    public PlaceDetailResponse getPlaceDetail(Long id, Double lat, Double lng) {
        Place place = placeRepository.findById(id)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.PLACE_NOT_FOUND));

        Double distanceKm = distanceKm(lat, lng, place);
        Integer driveTimeMin = driveTimeMin(distanceKm);
        // 비로그인 viewer 는 좋아요 상태 false 고정. visibility 필터에 viewerId=null 을
        // 그대로 넘기면 PlacePhotoRepository 의 JPQL 이 PUBLIC 만 통과시키므로 안전.
        Long viewerId = currentUser.currentUserIdOrNull();
        boolean liked = viewerId != null
                && placeLikeRepository.existsByUserIdAndPlaceId(viewerId, place.getId());

        List<PlacePhotoDto> photos = placePhotoRepository
                .findByPlaceIdOrderByOrderIndexAscIdAsc(place.getId(),
                        viewerId, PageRequest.of(0, PHOTO_LIMIT))
                .stream()
                .map(PlacePhotoDto::from)
                .toList();

        List<RelatedPlaceDto> related = placeRepository
                .findByContentIdAndIdNotOrderByTrendingScoreDescIdAsc(place.getContent().getId(), place.getId())
                .stream()
                .limit(RELATED_LIMIT)
                .map(RelatedPlaceDto::from)
                .toList();

        return PlaceDetailResponse.builder()
                .place(PlaceFullDto.of(place, distanceKm, driveTimeMin, liked))
                .photos(photos)
                .related(related)
                .build();
    }

    private static Double distanceKm(Double lat, Double lng, Place place) {
        return GeoUtils.distanceKmOrNull(lat, lng, place.getLatitude(), place.getLongitude());
    }

    private static Integer driveTimeMin(Double distanceKm) {
        if (distanceKm == null) return null;
        return (int) Math.round(distanceKm / AVERAGE_DRIVE_SPEED_KMH * 60.0);
    }
}
