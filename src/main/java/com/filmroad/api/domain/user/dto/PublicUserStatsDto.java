package com.filmroad.api.domain.user.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * 17-user-profile.html 의 4열 stats 카운트.
 */
@Getter
@Builder
public class PublicUserStatsDto {
    private int photoCount;
    private int followersCount;
    private int followingCount;
    private long badgeCount;
}
