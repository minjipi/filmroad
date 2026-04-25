package com.filmroad.api.domain.user.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * 공개 프로필 `recentCollectedWorks` 엔트리. 유저가 방문(stamp)한 작품별 진행률.
 * `collectedCount` = 해당 작품에서 이 유저가 남긴 stamp 수.
 * `totalCount`     = 해당 작품에 속한 전체 Place 수.
 */
@Getter
@Builder
public class CollectedWorkDto {
    private Long id;
    private String title;
    private String posterUrl;
    private long collectedCount;
    private long totalCount;
}
