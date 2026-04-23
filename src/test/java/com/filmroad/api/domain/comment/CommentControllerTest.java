package com.filmroad.api.domain.comment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.filmroad.api.domain.auth.JwtTokenService;
import com.filmroad.api.domain.comment.dto.CommentCreateRequest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class CommentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtTokenService jwtTokenService;

    private Cookie userCookie(long userId) {
        return new Cookie("ATOKEN", jwtTokenService.issueAccess(userId));
    }

    private String body(String content) throws Exception {
        return objectMapper.writeValueAsString(new CommentCreateRequest(content));
    }

    @Test
    @DisplayName("POST /api/photos/100/comments with ATOKEN returns CommentDto")
    void createComment_authenticated_returnsCommentDto() throws Exception {
        mockMvc.perform(post("/api/photos/100/comments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("좋은 사진이네요"))
                        .cookie(userCookie(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.content", is("좋은 사진이네요")))
                .andExpect(jsonPath("$.results.author.userId", is(1)));
    }

    @Test
    @DisplayName("POST /api/photos/100/comments without ATOKEN returns 401")
    void createComment_unauthenticated_returns401() throws Exception {
        mockMvc.perform(post("/api/photos/100/comments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("익명 댓글")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/photos/100/comments returns seeded comments ascending")
    void listComments_returnsAscending() throws Exception {
        mockMvc.perform(get("/api/photos/100/comments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.comments", hasSize(greaterThanOrEqualTo(3))))
                .andExpect(jsonPath("$.results.comments[0].id", lessThan(999)));
    }

    @Test
    @DisplayName("DELETE /api/comments/{id} by the author returns 204")
    void deleteComment_author_returns204() throws Exception {
        // seed: comment id=5 user_id=1
        mockMvc.perform(delete("/api/comments/5").cookie(userCookie(1L)))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("DELETE /api/comments/{id} by another user returns 403 UNAUTHORIZED_COMMENT")
    void deleteComment_nonAuthor_returns403() throws Exception {
        // seed: comment id=1 author user_id=2. user=1이 삭제 시도 → 403.
        mockMvc.perform(delete("/api/comments/1").cookie(userCookie(1L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(40370)));
    }
}
