package com.filmroad.api.domain.congestion.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * 혼잡도 forecast 한 항목 — 오늘/내일/주말 중 하나.
 *
 * <p>state 임계값:</p>
 * <ul>
 *   <li>{@code OK}    — percent &le; 50</li>
 *   <li>{@code BUSY}  — 50 &lt; percent &le; 70</li>
 *   <li>{@code PACK}  — 70 &lt; percent</li>
 * </ul>
 */
@Getter
@Builder
public class CongestionItemDto {
    /** 정렬/식별용 키. TODAY / TOMORROW / WEEKEND. */
    private String key;

    /** 사용자에게 보여줄 라벨 (예: "오늘", "내일", "이번 주말"). */
    private String label;

    /** 사용자에게 보여줄 날짜 라벨 (예: "5/1 금", "토·일 평균"). */
    private String dateLabel;

    /** 혼잡도 percent (0-100). */
    private int percent;

    /** OK / BUSY / PACK. */
    private String state;
}
