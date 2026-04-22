package com.filmroad.api.domain.stamp.dto;

import com.filmroad.api.domain.badge.dto.UserBadgeDto;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class StampbookResponse {
    private StampbookHeroDto hero;
    private List<WorkProgressDto> works;
    private List<UserBadgeDto> recentBadges;
}
