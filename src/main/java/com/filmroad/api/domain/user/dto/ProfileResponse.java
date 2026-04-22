package com.filmroad.api.domain.user.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class ProfileResponse {
    private UserMeDto user;
    private ProfileStatsDto stats;
    private List<MiniMapPinDto> miniMapPins;
}
