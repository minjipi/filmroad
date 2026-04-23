package com.filmroad.api.domain.auth.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * GET /api/auth/check-email 응답. `available=true` 면 설계 페이지의 "사용 가능한 이메일이에요" 표시.
 * 이메일 형식 부적합은 컨트롤러/서비스 단에서 400 으로 던지고 이 DTO 는 형식이 유효한 경우에만 반환한다.
 */
@Getter
@Builder
public class CheckEmailResponse {
    private boolean available;
}
