package com.filmroad.api.domain.user.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ProfileStatsDto {
    private long visitedCount;
    private int photoCount;
    private int followersCount;
    private int followingCount;
}
