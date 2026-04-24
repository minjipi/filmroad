package com.filmroad.api.domain.user.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * "스탬프 북" highlight ring — 유저가 많이 방문한 작품 순. count 는 해당 작품에 남긴 stamp 수.
 */
@Getter
@Builder
public class StampHighlightDto {
    private Long workId;
    private String workTitle;
    private String posterUrl;
    private long count;
}
