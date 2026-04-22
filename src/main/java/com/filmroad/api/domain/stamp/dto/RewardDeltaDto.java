package com.filmroad.api.domain.stamp.dto;

import com.filmroad.api.domain.badge.dto.UserBadgeDto;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class RewardDeltaDto {
    private int pointsEarned;
    private int currentPoints;
    private int streakDays;
    private int level;
    private String levelName;
    private List<UserBadgeDto> newBadges;
}
