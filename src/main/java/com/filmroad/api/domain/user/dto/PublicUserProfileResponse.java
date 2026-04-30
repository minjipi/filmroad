package com.filmroad.api.domain.user.dto;

import com.filmroad.api.domain.trophy.dto.ContentTrophyDto;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * `GET /api/users/:id` 응답 (17-user-profile.html). 프론트 store(`userProfile.ts`) 와 1:1.
 * 공개 엔드포인트 — 비로그인 viewer 도 조회 가능하며 그 때 `isMe=false`, `following=false`.
 */
@Getter
@Builder
public class PublicUserProfileResponse {
    // 상위 유저 메타 (flat)
    private Long id;
    private String nickname;
    private String handle;
    private String avatarUrl;
    private String bio;
    private boolean verified;
    private int level;
    private String levelName;
    private int points;
    private int streakDays;

    private PublicUserStatsDto stats;

    /**
     * viewer == target. 비로그인 조회 시 false. Boolean wrapper 로 선언해 Jackson 이
     * "is" 접두를 떼 `me` 로 직렬화하는 걸 방지 (primitive boolean 일 때 `getIsMe()` 가 아닌
     * `isMe()` 게터가 생성되어 발생).
     */
    private Boolean isMe;
    /** viewer 가 target 을 팔로우 중인지. 비로그인이면 false. */
    private boolean following;

    /** 공개 인증샷 grid preview (PUBLIC / 본인 / FOLLOWERS+follow). */
    private List<PublicPhotoDto> topPhotos;
    /** 최근 수집한 작품과 진행률. */
    private List<CollectedContentDto> recentCollectedContents;
    /** 작품 컴플리트 트로피 (마스터·진행 중). 사회 증명 — 비로그인 viewer 에게도 노출. */
    private List<ContentTrophyDto> trophies;
}
