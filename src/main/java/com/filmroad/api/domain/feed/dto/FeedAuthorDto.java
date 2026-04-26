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
    /** viewer 가 author 를 follow 중인지. 비로그인 / isMe / fallback (userId=null) 이면 false. */
    private boolean following;
}
