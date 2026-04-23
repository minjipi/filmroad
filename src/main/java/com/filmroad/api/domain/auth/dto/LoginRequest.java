package com.filmroad.api.domain.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 이메일 + 비밀번호 로그인 요청. 서버에서는 provider=EMAIL 로 가입한 유저만 검증 대상.
 */
@Getter
@Setter
@NoArgsConstructor
public class LoginRequest {

    @NotBlank(message = "이메일을 입력해주세요.")
    @Email(message = "이메일 형식이 올바르지 않습니다.")
    private String email;

    @NotBlank(message = "비밀번호를 입력해주세요.")
    private String password;
}
