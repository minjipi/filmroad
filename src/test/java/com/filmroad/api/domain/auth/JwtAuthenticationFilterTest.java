package com.filmroad.api.domain.auth;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class JwtAuthenticationFilterTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Test
    @DisplayName("유효 ATOKEN 쿠키로 /api/users/me 접근 시 200 + seeded user 응답")
    void validToken_accessesProtectedEndpoint() throws Exception {
        String token = jwtTokenService.issueAccess(1L);
        mockMvc.perform(get("/api/users/me").cookie(new Cookie("ATOKEN", token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.user.id", is(1)));
    }

    @Test
    @DisplayName("ATOKEN 없음 → /api/users/me 401")
    void missingToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("잘못된 ATOKEN → /api/users/me 401")
    void invalidToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/users/me").cookie(new Cookie("ATOKEN", "not-a-real-jwt")))
                .andExpect(status().isUnauthorized());
    }
}
