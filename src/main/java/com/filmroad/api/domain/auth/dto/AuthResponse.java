package com.filmroad.api.domain.auth.dto;

import com.filmroad.api.domain.user.dto.UserMeDto;
import lombok.Builder;
import lombok.Getter;

/**
 * 회원가입/로그인 성공 응답 바디. access token 은 Set-Cookie(ATOKEN)로도 내려가지만,
 * SPA가 상태 동기화에 필요하므로 body 에도 동봉한다. refresh token 은 쿠키(HttpOnly)로만 유지.
 */
@Getter
@Builder
public class AuthResponse {
    private String accessToken;
    private UserMeDto user;
}
