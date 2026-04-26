package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.user.User;
import lombok.Builder;
import lombok.Getter;

/**
 * 사진 작성자 정보. `isMe` 는 viewer 가 작성자 본인인지 — 프론트 편집/삭제 버튼 표시 판정용.
 * anonymous 시드 사진처럼 user 가 없는 경우 `authorNickname` 만 fallback 으로 채워 내려준다.
 */
@Getter
@Builder
public class PhotoDetailAuthorDto {
    private Long id;
    private String nickname;
    private String handle;
    private String avatarUrl;
    private Boolean verified;
    private Boolean isMe;
    /**
     * viewer 가 작성자를 follow 중인지. 비로그인 / isMe / fallback 작성자 면 false.
     * Boolean wrapper 로 선언해 Jackson 이 "is" 접두를 떼는 걸 방지.
     */
    private Boolean following;

    public static PhotoDetailAuthorDto of(User user, Long viewerId, boolean following) {
        if (user == null) return null;
        boolean isMe = viewerId != null && viewerId.equals(user.getId());
        return PhotoDetailAuthorDto.builder()
                .id(user.getId())
                .nickname(user.getNickname())
                .handle(user.getHandle())
                .avatarUrl(user.getAvatarUrl())
                .verified(user.isVerified())
                .isMe(isMe)
                .following(!isMe && following)
                .build();
    }

    public static PhotoDetailAuthorDto fallback(String authorNickname) {
        if (authorNickname == null || authorNickname.isBlank()) return null;
        return PhotoDetailAuthorDto.builder()
                .id(null)
                .nickname(authorNickname)
                .handle("@" + authorNickname)
                .avatarUrl(null)
                .verified(false)
                .isMe(false)
                .following(false)
                .build();
    }
}
