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
    // 업로드 직전 레벨. 프론트는 level != previousLevel 인 경우만 레벨업 애니메이션을 띄운다.
    private int previousLevel;
    private String levelName;
    private List<UserBadgeDto> newBadges;
}
