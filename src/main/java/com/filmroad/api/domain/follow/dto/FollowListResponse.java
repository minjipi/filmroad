package com.filmroad.api.domain.follow.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class FollowListResponse {
    private List<FollowUserDto> users;
    private boolean hasMore;
    /** 다음 페이지 호출 시 `cursor` 파라미터로 그대로 사용. 더 없으면 null. */
    private Long nextCursor;
}
