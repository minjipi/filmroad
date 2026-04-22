package com.filmroad.api.domain.user;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.stamp.Stamp;
import com.filmroad.api.domain.stamp.StampRepository;
import com.filmroad.api.domain.user.dto.MiniMapPinDto;
import com.filmroad.api.domain.user.dto.ProfileResponse;
import com.filmroad.api.domain.user.dto.ProfileStatsDto;
import com.filmroad.api.domain.user.dto.UserMeDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class UserService {

    private static final int MINI_MAP_PIN_LIMIT = 7;
    private static final String[] PIN_VARIANTS = {"PRIMARY", "VIOLET", "MINT"};

    private final UserRepository userRepository;
    private final StampRepository stampRepository;
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
}
