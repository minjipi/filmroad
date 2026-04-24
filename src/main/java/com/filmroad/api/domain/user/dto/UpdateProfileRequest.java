package com.filmroad.api.domain.user.dto;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 프로필 편집 요청. 모든 필드 optional — null 은 "변경 없음", 빈 문자열 / 공백은
 * 의도적 비우기로 처리 (bio / avatarUrl). nickname 은 공백 허용하지 않음.
 */
@Getter
@Setter
@NoArgsConstructor
public class UpdateProfileRequest {

    @Size(min = 1, max = 120, message = "닉네임은 1~120자 이내로 입력해주세요.")
    private String nickname;

    @Size(max = 300, message = "소개는 300자 이내로 입력해주세요.")
    private String bio;

    @Size(max = 500, message = "아바타 URL이 너무 깁니다.")
    private String avatarUrl;
}
