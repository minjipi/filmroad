package com.filmroad.api.common.auth;

import com.filmroad.api.domain.auth.JwtPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * 현재 인증된 userId. SecurityContext에 JwtPrincipal이 있으면 그 userId, 아니면 데모용 1L 폴백.
 * 프로덕션에서는 폴백 제거 + throw 필요. 테스트/미인증 경로에서 기존 호출자(Service)가 1L로 동작.
 */
@Component
public class CurrentUser {

    private static final long DEMO_USER_ID = 1L;

    public Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof JwtPrincipal p) {
            return p.userId();
        }
        return DEMO_USER_ID;
    }
}
