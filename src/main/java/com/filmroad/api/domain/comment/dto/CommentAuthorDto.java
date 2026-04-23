package com.filmroad.api.domain.comment.dto;

import com.filmroad.api.domain.user.User;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CommentAuthorDto {
    private Long userId;
    private String handle;
    private String nickname;
    private String avatarUrl;
    private boolean verified;

    public static CommentAuthorDto from(User user) {
        return CommentAuthorDto.builder()
                .userId(user.getId())
                .handle(user.getHandle())
                .nickname(user.getNickname())
                .avatarUrl(user.getAvatarUrl())
                .verified(user.isVerified())
                .build();
    }
}
