package com.filmroad.api.domain.follow;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.follow.dto.FollowListResponse;
import com.filmroad.api.domain.follow.dto.FollowToggleResponse;
import com.filmroad.api.domain.follow.dto.FollowUserDto;
import com.filmroad.api.domain.user.User;
import com.filmroad.api.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class FollowService {

    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 50;

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

    /**
     * `userId` 가 받는 follower 목록 (= 그 사용자를 팔로우하는 사람들). cursor 기반,
     * row id DESC. viewer 가 로그인 상태면 each row 의 `following` 플래그를 채워
     * 같은 리스트에서 follow/unfollow 토글이 가능하게 한다. 비로그인 / 본인 row 는
     * `following = false`.
     */
    @Transactional(readOnly = true)
    public FollowListResponse listFollowers(Long userId, Long cursor, int limit) {
        userRepository.findById(userId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.USER_NOT_FOUND));
        return loadList(userId, cursor, limit, /* followers = */ true);
    }

    /**
     * `userId` 가 follow 하는 followee 목록.
     */
    @Transactional(readOnly = true)
    public FollowListResponse listFollowings(Long userId, Long cursor, int limit) {
        userRepository.findById(userId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.USER_NOT_FOUND));
        return loadList(userId, cursor, limit, /* followers = */ false);
    }

    private FollowListResponse loadList(Long userId, Long cursor, int limit, boolean followers) {
        int safeLimit = limit <= 0 ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);
        long safeCursor = cursor == null ? Long.MAX_VALUE : cursor;
        int fetchSize = safeLimit + 1;

        List<UserFollow> fetched = followers
                ? userFollowRepository.findFollowersOf(userId, safeCursor, PageRequest.of(0, fetchSize))
                : userFollowRepository.findFollowingsOf(userId, safeCursor, PageRequest.of(0, fetchSize));

        boolean hasMore = fetched.size() > safeLimit;
        List<UserFollow> page = hasMore ? fetched.subList(0, safeLimit) : fetched;

        Long viewerId = currentUser.currentUserIdOrNull();

        // viewer 가 로그인 상태면 page 의 user id 들에 대해 viewer 가 follow 하는지 한 번에 조회.
        Set<Long> rowUserIds = page.stream()
                .map(f -> followers ? f.getFollower().getId() : f.getFollowee().getId())
                .collect(java.util.stream.Collectors.toSet());
        Set<Long> followingSet = (viewerId == null || rowUserIds.isEmpty())
                ? Set.of()
                : Set.copyOf(userFollowRepository.findFolloweeIdsByFollowerAndFolloweeIdIn(viewerId, rowUserIds));

        List<FollowUserDto> users = page.stream()
                .map(f -> {
                    User u = followers ? f.getFollower() : f.getFollowee();
                    boolean following = followingSet.contains(u.getId());
                    boolean isMe = viewerId != null && viewerId.equals(u.getId());
                    return FollowUserDto.from(u, following, isMe);
                })
                .toList();

        Long nextCursor = hasMore && !page.isEmpty()
                ? page.get(page.size() - 1).getId()
                : null;

        return FollowListResponse.builder()
                .users(users)
                .hasMore(hasMore)
                .nextCursor(nextCursor)
                .build();
    }
}
