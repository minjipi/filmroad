package com.filmroad.api.common.auth;

import org.springframework.stereotype.Component;

/**
 * OAuth 연결 전까지 사용할 데모 세션 주체. 추후 SecurityContextHolder에서 꺼내도록 대체.
 */
@Component
public class CurrentUser {

    private static final long DEMO_USER_ID = 1L;

    public Long currentUserId() {
        return DEMO_USER_ID;
    }
}
