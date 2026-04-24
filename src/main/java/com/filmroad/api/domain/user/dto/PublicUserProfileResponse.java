package com.filmroad.api.domain.user.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * `GET /api/users/:id` 응답 (17-user-profile.html). header / stats / follow 플래그 /
 * stampHighlights / 최근 인증샷 preview 묶음.
 */
@Getter
@Builder
public class PublicUserProfileResponse {
    private PublicUserDto user;
    private PublicUserStatsDto stats;

    /** viewer 가 대상 유저를 팔로우 중인지. 팔로우 버튼 toggle 표시용. */
    private boolean following;
    /** viewer == 대상 유저. 본인 프로필일 때 팔로우 버튼 대신 "편집" 보여주기 위함. */
    private Boolean isMe;

    private List<StampHighlightDto> stampHighlights;
    private List<PublicPhotoDto> photos;
}
