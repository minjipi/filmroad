package com.filmroad.api.domain.feed.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class FeedAuthorDto {
    private Long userId;
    private String handle;
    private String nickname;
    private String avatarUrl;
    private boolean verified;
}
