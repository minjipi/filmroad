package com.filmroad.api.domain.stamp;

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for GET /api/stampbook. Relies on seeded stamps + badges for demo user.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class StampbookControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenService jwtTokenService;

    private Cookie demoAccessCookie() {
        return new Cookie("ATOKEN", jwtTokenService.issueAccess(1L));
    }

    @Test
    @DisplayName("GET /api/stampbook returns hero counts and work progress bounded by totals")
    void getStampbook_returnsHeroAndWorks() throws Exception {
        mockMvc.perform(get("/api/stampbook").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.hero.worksCollectingCount", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.results.hero.placesCollectedCount", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.results.works", not(empty())))
                .andExpect(jsonPath("$.results.works[?(@.collectedCount > @.totalCount)]", hasSize(0)));
    }

    @Test
    @DisplayName("recentBadges includes at least 3 acquired + 1 locked badge")
    void getStampbook_recentBadges_mixesAcquiredAndLocked() throws Exception {
        mockMvc.perform(get("/api/stampbook").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.recentBadges[?(@.acquired == true)]", hasSize(greaterThanOrEqualTo(3))))
                .andExpect(jsonPath("$.results.recentBadges[?(@.acquired == false)]", hasSize(greaterThanOrEqualTo(1))));
    }
}
