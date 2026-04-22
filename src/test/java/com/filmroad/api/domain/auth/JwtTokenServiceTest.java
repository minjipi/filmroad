package com.filmroad.api.domain.auth;

import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class JwtTokenServiceTest {

    @Autowired
    private JwtTokenService jwtTokenService;

    @Test
    @DisplayName("issueAccess → parseUserId 왕복 시 동일 userId 복원")
    void roundTrip_returnsSameUserId() {
        String token = jwtTokenService.issueAccess(42L);
        assertThat(jwtTokenService.parseUserId(token)).isEqualTo(42L);
    }

    @Test
    @DisplayName("변조된 토큰은 JwtException throw")
    void tamperedToken_throws() {
        String token = jwtTokenService.issueAccess(42L) + "tampered";
        assertThatThrownBy(() -> jwtTokenService.parseUserId(token))
                .isInstanceOf(JwtException.class);
    }

    @Test
    @DisplayName("만료된 토큰은 JwtException throw")
    void expiredToken_throws() throws Exception {
        String token = jwtTokenService.issueWithTtl(42L, 1L);
        Thread.sleep(20);
        assertThatThrownBy(() -> jwtTokenService.parseUserId(token))
                .isInstanceOf(JwtException.class);
    }
}
