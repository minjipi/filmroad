package com.filmroad.api.domain.user.dto;

import com.filmroad.api.domain.trophy.dto.ContentTrophyDto;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class ProfileResponse {
    private UserMeDto user;
    private ProfileStatsDto stats;
    private List<MiniMapPinDto> miniMapPins;
    /** 작품 컴플리트 트로피 — 자랑 슬롯 데이터. 비어있을 수 있음(아직 25% 미만). */
    private List<ContentTrophyDto> trophies;
}
