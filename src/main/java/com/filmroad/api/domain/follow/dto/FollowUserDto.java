package com.filmroad.api.domain.follow.dto;

import com.filmroad.api.domain.user.User;
import lombok.Builder;
import lombok.Getter;

/**
 * 팔로워 / 팔로잉 목록의 한 row. viewer 기준 follow 상태(`following`) 와 본인 여부
 * (`isMe`) 가 포함되어, 같은 리스트 안에서 곧장 follow/unfollow 토글 가능하게 한다.
 */
@Getter
@Builder
public class FollowUserDto {
    private Long id;
    private String nickname;
    private String handle;
    private String avatarUrl;
    /** viewer 가 이 user 를 follow 중인지. 비로그인 / 본인 row 면 false. */
    private boolean following;
    /**
     * viewer 가 이 row 의 user 인지 — UI 에서 follow 버튼 숨기는 용도.
     * Boolean wrapper 로 선언해 Jackson 이 "is" 접두를 떼 `me` 로 직렬화하는 걸 방지
     * (primitive boolean 일 때 `getIsMe()` 가 아닌 `isMe()` 게터가 생성되어 발생).
     */
    private Boolean isMe;

    public static FollowUserDto from(User user, boolean following, boolean isMe) {
        return FollowUserDto.builder()
                .id(user.getId())
                .nickname(user.getNickname())
                .handle(user.getHandle())
                .avatarUrl(user.getAvatarUrl())
                .following(following)
                .isMe(isMe)
                .build();
    }
}
