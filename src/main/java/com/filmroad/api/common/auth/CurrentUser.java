package com.filmroad.api.common.auth;

import com.filmroad.api.domain.auth.JwtPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * 현재 인증된 userId. SecurityContext 에 JwtPrincipal 이 있으면 그 userId 를 반환,
 * 없으면 {@link IllegalStateException} 를 throw — 인증 강제 엔드포인트(SecurityConfig 에서
 * authenticated() 매처) 전용. 미인증 경로에서 호출하면 즉시 fail-fast 한다.
 *
 * <p>permitAll 매처 (홈/피드/장소상세/공개프로필 등) 에서 viewer 의 personalized
 * 정보(좋아요/팔로우/저장)를 채울 때는 반드시 {@link #currentUserIdOrNull()} 을 사용한다.
 * 그렇지 않으면 익명 viewer 가 임의 사용자의 personalized 데이터를 보게 되는 leak 이 발생.
 */
@Component
public class CurrentUser {

    public Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof JwtPrincipal p) {
            return p.userId();
        }
        // 인증 강제 엔드포인트에서만 호출돼야 함 — 도달했다는 건 SecurityConfig 매처가
        // 잘못 풀려있거나, permitAll 엔드포인트에서 currentUserIdOrNull() 대신 이 메서드를
        // 쓰고 있다는 뜻. 둘 다 보안 문제이므로 데모 fallback 으로 가리지 않고 깬다.
        throw new IllegalStateException(
                "currentUserId() called without authentication; use currentUserIdOrNull() for public endpoints");
    }

    /**
     * 실제 로그인 유저 id 만 반환. 인증 없으면 null.
     * 공개(permitAll) 엔드포인트에서 "viewer 있으면 ~, 없으면 ~" 분기할 때 사용.
     */
    public Long currentUserIdOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof JwtPrincipal p) {
            return p.userId();
        }
        return null;
    }
}
