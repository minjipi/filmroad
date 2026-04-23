package com.filmroad.api.domain.feed;

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

    @Test
    @DisplayName("GET /api/feed (default POPULAR) returns posts with author/place/work + pagination flags")
    void getFeed_defaultPopular_returnsPostsWithRichFields() throws Exception {
        mockMvc.perform(get("/api/feed"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.posts", not(empty())))
                .andExpect(jsonPath("$.results.posts[0].author", notNullValue()))
                .andExpect(jsonPath("$.results.posts[0].place.id", notNullValue()))
                .andExpect(jsonPath("$.results.posts[0].work.id", notNullValue()))
                .andExpect(jsonPath("$.results.hasMore", anyOf(is(true), is(false))));
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
