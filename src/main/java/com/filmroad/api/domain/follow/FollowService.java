package com.filmroad.api.domain.follow;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.follow.dto.FollowToggleResponse;
import com.filmroad.api.domain.user.User;
import com.filmroad.api.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FollowService {

    private final UserFollowRepository userFollowRepository;
    private final UserRepository userRepository;
    private final CurrentUser currentUser;

    @Transactional
    public FollowToggleResponse toggleFollow(Long followeeId) {
        Long followerId = currentUser.currentUserId();
        if (followerId.equals(followeeId)) {
            throw BaseException.of(BaseResponseStatus.SELF_FOLLOW_FORBIDDEN);
        }
        User follower = userRepository.findById(followerId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.USER_NOT_FOUND));
        User followee = userRepository.findById(followeeId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.USER_NOT_FOUND));

        boolean following;
        if (userFollowRepository.existsByFollowerIdAndFolloweeId(followerId, followeeId)) {
            userFollowRepository.deleteByFollowerIdAndFolloweeId(followerId, followeeId);
            follower.applyFollowingDelta(-1);
            followee.applyFollowerDelta(-1);
            following = false;
        } else {
            userFollowRepository.save(UserFollow.builder()
                    .follower(follower)
                    .followee(followee)
                    .build());
            follower.applyFollowingDelta(1);
            followee.applyFollowerDelta(1);
            following = true;
        }
        return FollowToggleResponse.builder()
                .following(following)
                .followersCount(followee.getFollowersCount())
                .followingCount(follower.getFollowingCount())
                .build();
    }
}
