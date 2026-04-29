package com.filmroad.api.domain.like;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.like.dto.LikeToggleResponse;
import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PhotoVisibilityGuard;
import com.filmroad.api.domain.place.PlacePhoto;
import com.filmroad.api.domain.place.PlacePhotoRepository;
import com.filmroad.api.domain.place.PlaceRepository;
import com.filmroad.api.domain.user.User;
import com.filmroad.api.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LikeService {

    private final PlaceLikeRepository placeLikeRepository;
    private final PhotoLikeRepository photoLikeRepository;
    private final PlaceRepository placeRepository;
    private final PlacePhotoRepository placePhotoRepository;
    private final UserRepository userRepository;
    private final CurrentUser currentUser;
    private final PhotoVisibilityGuard photoVisibilityGuard;

    @Transactional
    public LikeToggleResponse togglePlaceLike(Long placeId) {
        Long userId = currentUser.currentUserId();
        Place place = placeRepository.findById(placeId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.PLACE_NOT_FOUND));

        boolean liked;
        if (placeLikeRepository.existsByUserIdAndPlaceId(userId, placeId)) {
            placeLikeRepository.deleteByUserIdAndPlaceId(userId, placeId);
            place.applyLikeDelta(-1);
            liked = false;
        } else {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> BaseException.of(BaseResponseStatus.RESPONSE_NULL_ERROR));
            placeLikeRepository.save(PlaceLike.builder().user(user).place(place).build());
            place.applyLikeDelta(1);
            liked = true;
        }
        return LikeToggleResponse.builder().liked(liked).likeCount(place.getLikeCount()).build();
    }

    @Transactional
    public LikeToggleResponse togglePhotoLike(Long photoId) {
        Long userId = currentUser.currentUserId();
        PlacePhoto photo = placePhotoRepository.findById(photoId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.PHOTO_NOT_FOUND));
        // PRIVATE / FOLLOWERS 사진에 비작성자 / 비팔로워가 직접 API 를 호출해
        // 좋아요를 박는 경로 차단. PhotoDetailService 가 같은 사진에 대해 적용하는
        // 규칙과 동일 — 권한 없음은 PHOTO_NOT_FOUND 로 통일해 enumeration 차단.
        photoVisibilityGuard.assertViewable(photo, userId);

        boolean liked;
        if (photoLikeRepository.existsByUserIdAndPlacePhotoId(userId, photoId)) {
            photoLikeRepository.deleteByUserIdAndPlacePhotoId(userId, photoId);
            photo.applyLikeDelta(-1);
            liked = false;
        } else {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> BaseException.of(BaseResponseStatus.RESPONSE_NULL_ERROR));
            photoLikeRepository.save(PhotoLike.builder().user(user).placePhoto(photo).build());
            photo.applyLikeDelta(1);
            liked = true;
        }
        return LikeToggleResponse.builder().liked(liked).likeCount(photo.getLikeCount()).build();
    }
}
