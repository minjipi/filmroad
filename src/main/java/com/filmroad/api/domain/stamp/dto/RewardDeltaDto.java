package com.filmroad.api.domain.stamp.dto;

import com.filmroad.api.domain.badge.dto.UserBadgeDto;
import com.filmroad.api.domain.trophy.ContentTrophyTier;
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

    /**
     * 이번 업로드로 새로 진입한 작품 트로피 단계. null 이면 변동 없음.
     * MASTER 면 프론트가 풀스크린 오버레이, 그 외(QUARTER/HALF/THREE_Q)는 토스트로
     * 표시한다. 같은 작품의 같은 tier 는 한번만 발급(중복 알림 차단).
     */
    private ContentTrophyTier newTrophyTier;
    private String newTrophyContentTitle;
    private String newTrophyContentPosterUrl;
}
