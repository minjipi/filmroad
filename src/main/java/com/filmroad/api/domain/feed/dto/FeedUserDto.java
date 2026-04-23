package com.filmroad.api.domain.feed.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class FeedUserDto {
    private Long userId;
    private String handle;
    private String nickname;
    private String avatarUrl;
    private boolean verified;
    private String workTitle;
    private long stampCountForWork;
    private boolean following;
}
