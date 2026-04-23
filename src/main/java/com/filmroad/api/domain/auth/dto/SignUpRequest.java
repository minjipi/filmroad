package com.filmroad.api.domain.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 이메일 회원가입 요청. 기존 auth store 규약에 맞춰 `{name, email, password}` 만 받는다.
 * 약관 동의 플래그는 프론트에서 UX 차원으로만 수집하고, API 계약에는 포함하지 않는다.
 */
@Getter
@Setter
@NoArgsConstructor
public class SignUpRequest {

    @NotBlank(message = "이름을 입력해주세요.")
    @Size(max = 120, message = "이름은 120자 이하로 입력해주세요.")
    private String name;

    @NotBlank(message = "이메일을 입력해주세요.")
    @Email(message = "이메일 형식이 올바르지 않습니다.")
    @Size(max = 200, message = "이메일은 200자 이하로 입력해주세요.")
    private String email;

    // 최소 8자, 영문 + 숫자 포함. 설계 페이지의 플레이스홀더 "8자 이상, 문자·숫자 포함" 과 일치.
    @NotBlank(message = "비밀번호를 입력해주세요.")
    @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).{8,}$",
            message = "비밀번호는 8자 이상이며 영문과 숫자를 모두 포함해야 합니다.")
    private String password;
}
