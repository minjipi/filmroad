package com.filmroad.api.domain.follow;

import com.filmroad.api.domain.auth.JwtTokenService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class FollowControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenService jwtTokenService;

    private Cookie userCookie(long userId) {
        return new Cookie("ATOKEN", jwtTokenService.issueAccess(userId));
    }

    @Test
    @DisplayName("POST /api/users/5/follow first time → following=true")
    void toggleFollow_firstTime_setsTrue() throws Exception {
        // user=1 is not following user=5 in seed (user=5 follows user=1 but not reverse)
        mockMvc.perform(post("/api/users/5/follow").cookie(userCookie(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.following", is(true)))
                .andExpect(jsonPath("$.results.followersCount", greaterThanOrEqualTo(1)));
    }

    @Test
    @DisplayName("POST /api/users/5/follow twice → following=false (toggle back)")
    void toggleFollow_twice_flipsBack() throws Exception {
        mockMvc.perform(post("/api/users/5/follow").cookie(userCookie(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.following", is(true)));
        mockMvc.perform(post("/api/users/5/follow").cookie(userCookie(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.following", is(false)));
    }

    @Test
    @DisplayName("POST /api/users/2/follow without ATOKEN → 401")
    void toggleFollow_unauthenticated_returns401() throws Exception {
        mockMvc.perform(post("/api/users/2/follow"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/users/1/follow as user=1 → 400 SELF_FOLLOW_FORBIDDEN")
    void toggleFollow_self_returns400() throws Exception {
        mockMvc.perform(post("/api/users/1/follow").cookie(userCookie(1L)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(40080)));
    }
}
