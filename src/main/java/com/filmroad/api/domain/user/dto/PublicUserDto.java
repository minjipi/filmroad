package com.filmroad.api.domain.user.dto;

import com.filmroad.api.domain.user.User;
import lombok.Builder;
import lombok.Getter;

/**
 * 공개 프로필 header 정보. 현재 User 엔티티에 cover/location/link 필드가 없어 nullable 필드로 노출 —
 * 향후 프로필 편집에서 확장 가능.
 */
@Getter
@Builder
public class PublicUserDto {
    private Long id;
    private String nickname;
    private String handle;
    private String avatarUrl;
    private String coverUrl;
    private String bio;
    private int level;
    private String levelName;
    private boolean verified;

    public static PublicUserDto from(User user) {
        return PublicUserDto.builder()
                .id(user.getId())
                .nickname(user.getNickname())
                .handle(user.getHandle())
                .avatarUrl(user.getAvatarUrl())
                .coverUrl(null)
                .bio(user.getBio())
                .level(user.getLevel())
                .levelName(UserMeDto.levelName(user.getLevel()))
                .verified(user.isVerified())
                .build();
    }
}
