package com.filmroad.api.domain.follow.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class FollowToggleResponse {
    private boolean following;
    private int followersCount;
    private int followingCount;
}
