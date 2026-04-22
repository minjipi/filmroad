package com.filmroad.api.domain.user;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for GET /api/users/me. Uses the seeded demo user (id=1).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("GET /api/users/me returns demo user profile with seeded stats and mini-map pins")
    void getMe_returnsSeededProfile() throws Exception {
        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.code", is(20000)))
                .andExpect(jsonPath("$.results.user.handle", is("@miru")))
                .andExpect(jsonPath("$.results.user.nickname", is("김미루")))
                .andExpect(jsonPath("$.results.stats.visitedCount", greaterThanOrEqualTo(5)))
                .andExpect(jsonPath("$.results.miniMapPins", not(empty())));
    }

    @Test
    @DisplayName("level=5 maps to levelName '성지 순례자'")
    void getMe_level5_mapsToSeongjiLevel() throws Exception {
        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.user.level", is(5)))
                .andExpect(jsonPath("$.results.user.levelName", is("성지 순례자")));
    }
}
