package com.filmroad.api.domain.trophy.dto;

import com.filmroad.api.domain.trophy.ContentTrophy;
import com.filmroad.api.domain.trophy.ContentTrophyTier;
import lombok.Builder;
import lombok.Getter;

import java.util.Date;

/**
 * 프로필 / 공개 프로필 응답에 들어가는 트로피 카드 한 장.
 * 진행 중(QUARTER/HALF/THREE_Q) 도 함께 노출되므로 collectedCount / totalCount 같이 보낸다.
 */
@Getter
@Builder
public class ContentTrophyDto {
    private Long contentId;
    private String contentTitle;
    private String contentPosterUrl;
    private ContentTrophyTier tier;
    private Date awardedAt;
    /** 현재 시점의 진행도 — UI 의 percent bar 표시용. */
    private long collectedCount;
    private long totalCount;
    private int percent;

    public static ContentTrophyDto of(ContentTrophy trophy, long collectedCount, long totalCount) {
        int percent = totalCount == 0 ? 0 : (int) Math.round(100.0 * collectedCount / totalCount);
        return ContentTrophyDto.builder()
                .contentId(trophy.getContent().getId())
                .contentTitle(trophy.getContent().getTitle())
                .contentPosterUrl(trophy.getContent().getPosterUrl())
                .tier(trophy.getTier())
                .awardedAt(trophy.getAwardedAt())
                .collectedCount(collectedCount)
                .totalCount(totalCount)
                .percent(percent)
                .build();
    }
}
