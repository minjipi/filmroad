package com.filmroad.api.domain.feed;

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
 * Integration tests for /api/feed (public GET). Seed: 8 places × 6 photos 각, user_id 순환, like_count 분산.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class FeedControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenService jwtTokenService;

    private Cookie userCookie(long userId) {
        return new Cookie("ATOKEN", jwtTokenService.issueAccess(userId));
    }

    @Test
    @DisplayName("GET /api/feed (default RECENT) — posts 는 id DESC 로 최신 먼저, 시드 최대 id(175) 가 상단")
    void getFeed_defaultRecent_returnsPostsNewestFirst() throws Exception {
        mockMvc.perform(get("/api/feed"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.posts", not(empty())))
                .andExpect(jsonPath("$.results.posts[0].author", notNullValue()))
                .andExpect(jsonPath("$.results.posts[0].place.id", notNullValue()))
                .andExpect(jsonPath("$.results.posts[0].work.id", notNullValue()))
                // 시드에서 가장 큰 photo id 는 175 (place 17, order 5). RECENT 기본이면 첫 번째로 나와야 함.
                .andExpect(jsonPath("$.results.posts[0].id", is(175)))
                .andExpect(jsonPath("$.results.hasMore", anyOf(is(true), is(false))));
    }

    @Test
    @DisplayName("GET /api/feed?tab=POPULAR — like_count DESC 정렬 (기본 RECENT 와 결과 달라야)")
    void getFeed_popularTab_ordersByLikeCount() throws Exception {
        // 시드상 가장 like_count 가 높은 photo 는 100 (영진파도, like_count=128).
        mockMvc.perform(get("/api/feed").param("tab", "POPULAR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.posts[0].id", is(100)))
                .andExpect(jsonPath("$.results.posts[0].likeCount", is(128)));
    }

    @Test
    @DisplayName("GET /api/feed?tab=RECENT 명시 → 기본값과 동일한 최신순 결과")
    void getFeed_explicitRecentTab_matchesDefault() throws Exception {
        mockMvc.perform(get("/api/feed").param("tab", "RECENT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.posts[0].id", is(175)));
    }

    @Test
    @DisplayName("GET /api/feed?tab=BY_WORK&workId=1 returns posts all tagged to work 1")
    void getFeed_byWork_filtersToSingleWork() throws Exception {
        mockMvc.perform(get("/api/feed")
                        .param("tab", "BY_WORK")
                        .param("workId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.posts", not(empty())))
                .andExpect(jsonPath("$.results.posts[*].work.id", everyItem(is(1))));
    }

    @Test
    @DisplayName("GET /api/feed (logged-in viewer) — viewer 가 follow 중인 author 의 row 만 following=true")
    void getFeed_loggedIn_authorFollowingReflectsViewerRelation() throws Exception {
        // 시드: user=1 follows user=2,3,4 → 그 사용자들이 author 인 post 는 following=true,
        // 나머지(user=5 등) 는 false. user=1 토큰으로 조회.
        mockMvc.perform(get("/api/feed").param("limit", "20").cookie(userCookie(1L)))
                .andExpect(status().isOk())
                // 시드 author user_id 는 1~5 순환 — viewer=1 본인 post 는 following=false.
                .andExpect(jsonPath("$.results.posts[?(@.author.userId == 1)].author.following",
                        everyItem(is(false))))
                // user=2 가 author 인 post 는 시드상 user=1 의 following 대상이라 true.
                .andExpect(jsonPath("$.results.posts[?(@.author.userId == 2)].author.following",
                        everyItem(is(true))))
                // user=5 는 user=1 의 following 대상이 아님.
                .andExpect(jsonPath("$.results.posts[?(@.author.userId == 5)].author.following",
                        everyItem(is(false))));
    }

    @Test
    @DisplayName("GET /api/feed/recommended-users?workId=1&limit=4 returns at most 4 users")
    void getRecommendedUsers_respectsLimit() throws Exception {
        mockMvc.perform(get("/api/feed/recommended-users")
                        .param("workId", "1")
                        .param("limit", "4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results", hasSize(lessThanOrEqualTo(4))));
    }
}
