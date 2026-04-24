package com.filmroad.api.domain.user.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * 17-user-profile.html 의 stats 카운트. 공개 프로필 header 아래 4열(+뱃지 optional) 중 frontend 가 쓰는 값만.
 */
@Getter
@Builder
public class PublicUserStatsDto {
    private long visitedCount;          // 유저가 찍은 stamp 수
    private int photoCount;             // 업로드한 PlacePhoto 수 (user.totalPhotoCount)
    private int followersCount;
    private int followingCount;
    private long collectedWorksCount;   // 수집 중인 distinct work 수
}
