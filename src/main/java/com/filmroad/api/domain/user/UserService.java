package com.filmroad.api.domain.user;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.place.PlacePhotoRepository;
import com.filmroad.api.domain.stamp.Stamp;
import com.filmroad.api.domain.stamp.StampRepository;
import com.filmroad.api.domain.place.PlacePhoto;
import com.filmroad.api.domain.user.dto.MiniMapPinDto;
import com.filmroad.api.domain.user.dto.MyPhotoDto;
import com.filmroad.api.domain.user.dto.MyPhotosResponse;
import com.filmroad.api.domain.user.dto.ProfileResponse;
import com.filmroad.api.domain.user.dto.ProfileStatsDto;
import com.filmroad.api.domain.user.dto.UpdateProfileRequest;
import com.filmroad.api.domain.user.dto.UserMeDto;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class UserService {

    private static final int MINI_MAP_PIN_LIMIT = 7;
    private static final String[] PIN_VARIANTS = {"PRIMARY", "VIOLET", "MINT"};
    // ProfilePage 인증샷 grid 기본값 / 상한. 60 까지로 제한해 infinite scroll 페이지당 부담을 제한.
    private static final int MY_PHOTOS_DEFAULT_LIMIT = 30;
    private static final int MY_PHOTOS_MAX_LIMIT = 60;

    private final UserRepository userRepository;
    private final StampRepository stampRepository;
    private final PlacePhotoRepository placePhotoRepository;
    private final CurrentUser currentUser;

    @Transactional(readOnly = true)
    public ProfileResponse getMe() {
        Long userId = currentUser.currentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.RESPONSE_NULL_ERROR));

        long visitedCount = stampRepository.countByUserId(userId);

        List<Stamp> recent = stampRepository.findByUserIdOrderByAcquiredAtDesc(userId);
        List<MiniMapPinDto> pins = IntStream.range(0, Math.min(recent.size(), MINI_MAP_PIN_LIMIT))
                .mapToObj(i -> {
                    Stamp s = recent.get(i);
                    return MiniMapPinDto.builder()
                            .latitude(s.getPlace().getLatitude())
                            .longitude(s.getPlace().getLongitude())
                            .variant(PIN_VARIANTS[i % PIN_VARIANTS.length])
                            .build();
                })
                .toList();

        ProfileStatsDto stats = ProfileStatsDto.builder()
                .visitedCount(visitedCount)
                .photoCount(user.getTotalPhotoCount())
                .followersCount(user.getFollowersCount())
                .followingCount(user.getFollowingCount())
                .build();

        return ProfileResponse.builder()
                .user(UserMeDto.from(user))
                .stats(stats)
                .miniMapPins(pins)
                .build();
    }

    /**
     * 로그인 유저가 업로드한 PlacePhoto 최신순 + cursor 기반 페이지네이션.
     * 본인 것이라 visibility 필터 불필요 (PRIVATE 포함 모두 반환).
     * fetchSize = limit + 1 로 조회해 마지막 항목이 다음 페이지 존재 판정용.
     */
    @Transactional(readOnly = true)
    public MyPhotosResponse getMyPhotos(Long cursor, Integer limit) {
        int safeLimit = (limit == null || limit <= 0) ? MY_PHOTOS_DEFAULT_LIMIT
                : Math.min(limit, MY_PHOTOS_MAX_LIMIT);
        Long userId = currentUser.currentUserId();

        int fetchSize = safeLimit + 1;
        List<PlacePhoto> fetched = placePhotoRepository
                .findByUserIdOrderByIdDesc(userId, cursor, PageRequest.of(0, fetchSize));

        boolean hasMore = fetched.size() > safeLimit;
        List<PlacePhoto> page = hasMore ? fetched.subList(0, safeLimit) : fetched;
        Long nextCursor = (hasMore && !page.isEmpty()) ? page.get(page.size() - 1).getId() : null;

        return MyPhotosResponse.builder()
                .photos(page.stream().map(MyPhotoDto::from).toList())
                .nextCursor(nextCursor)
                .build();
    }

    @Transactional
    public UserMeDto updateMe(UpdateProfileRequest req) {
        Long userId = currentUser.currentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.RESPONSE_NULL_ERROR));
        user.updateProfile(req.getNickname(), req.getBio(), req.getAvatarUrl());
        return UserMeDto.from(user);
    }
}
