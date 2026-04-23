package com.filmroad.api.domain.feed.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class FeedResponse {
    private List<FeedPostDto> posts;
    private List<FeedUserDto> recommendedUsers;
    private boolean hasMore;
    private Long nextCursor;
}
