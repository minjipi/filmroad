package com.filmroad.api.domain.user.dto;

import com.filmroad.api.domain.user.User;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UserMeDto {
    private Long id;
    private String nickname;
    private String handle;
    private String avatarUrl;
    private String bio;
    private int level;
    private String levelName;
    private int points;
    private int streakDays;
    private int followersCount;
    private int followingCount;

    public static UserMeDto from(User user) {
        return UserMeDto.builder()
                .id(user.getId())
                .nickname(user.getNickname())
                .handle(user.getHandle())
                .avatarUrl(user.getAvatarUrl())
                .bio(user.getBio())
                .level(user.getLevel())
                .levelName(levelName(user.getLevel()))
                .points(user.getPoints())
                .streakDays(user.getStreakDays())
                .followersCount(user.getFollowersCount())
                .followingCount(user.getFollowingCount())
                .build();
    }

    public static String levelName(int level) {
        if (level <= 2) return "입문 순례자";
        if (level <= 4) return "성실 순례자";
        if (level <= 6) return "성지 순례자";
        if (level <= 9) return "베테랑 순례자";
        return "마스터";
    }
}
