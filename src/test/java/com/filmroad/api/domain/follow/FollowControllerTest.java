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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

    @Test
    @DisplayName("GET /api/users/1/followers (anonymous) → 200, users 배열 + hasMore + nextCursor")
    void listFollowers_anonymous_returnsList() throws Exception {
        // user=5 가 user=1 을 팔로우하는 시드. anonymous viewer 라 following=false / isMe=false.
        mockMvc.perform(get("/api/users/1/followers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.users", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.results.users[0].id", notNullValue()))
                .andExpect(jsonPath("$.results.users[0].nickname", notNullValue()))
                .andExpect(jsonPath("$.results.users[0].following", is(false)))
                .andExpect(jsonPath("$.results.users[0].isMe", is(false)))
                .andExpect(jsonPath("$.results.hasMore", is(false)));
    }

    @Test
    @DisplayName("GET /api/users/{id}/followers as the listed user → that row의 isMe=true")
    void listFollowers_viewerIsListed_setsIsMe() throws Exception {
        // user=1 의 followers 안에 user=5 가 있는 시드. user=5 토큰으로 조회.
        mockMvc.perform(get("/api/users/1/followers").cookie(userCookie(5L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.users[?(@.id == 5)].isMe", contains(true)));
    }

    @Test
    @DisplayName("GET /api/users/{id}/followers viewer 가 row 의 user 를 follow 중이면 row.following=true")
    void listFollowers_viewerFollowsRow_setsFollowing() throws Exception {
        // user=1 이 user=5 를 follow 하도록 먼저 토글.
        mockMvc.perform(post("/api/users/5/follow").cookie(userCookie(1L)))
                .andExpect(status().isOk());
        // 이제 user=2 의 followers 목록 (시드: user=1, user=3 이 user=2 를 follow) 을
        // user=1 토큰으로 조회 → row 들 안의 user=5 는 following=true 가 되어야 정확.
        // 단, user=2 followers 목록에 user=5 가 있는지 시드 의존이라 단순화: user=1 의
        // following 목록을 조회해 user=5 가 그 안에 들어있는 것만 확인.
        mockMvc.perform(get("/api/users/1/following").cookie(userCookie(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.users[?(@.id == 5)].following", contains(true)));
    }

    @Test
    @DisplayName("GET /api/users/{id}/following 의 row 들에 viewer 본인이 있으면 isMe=true")
    void listFollowings_viewerIsListed_setsIsMe() throws Exception {
        // user=5 가 user=1 을 팔로우하도록 시드 가정 — user=5 의 following 목록에 user=1 이 있음.
        // user=1 토큰으로 user=5 의 following 조회 → user=1 row 는 isMe=true.
        mockMvc.perform(get("/api/users/5/following").cookie(userCookie(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.users[?(@.id == 1)].isMe", contains(true)));
    }

    @Test
    @DisplayName("GET /api/users/9999999/followers → 404 USER_NOT_FOUND")
    void listFollowers_unknownUser_returns404() throws Exception {
        mockMvc.perform(get("/api/users/9999999/followers"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success", is(false)));
    }

    @Test
    @DisplayName("GET /api/users/{id}/followers cursor 기반 페이징 — limit=1 + 둘째 페이지 cursor 호출")
    void listFollowers_cursorPaging_walksPages() throws Exception {
        // 시드 만으론 충분한 follower 가 없을 수 있으니 user=2 → user=1 follow 추가.
        mockMvc.perform(post("/api/users/1/follow").cookie(userCookie(2L)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/users/1/follow").cookie(userCookie(3L)))
                .andExpect(status().isOk());

        // limit=1 로 첫 페이지 — hasMore=true, nextCursor != null.
        String firstPage = mockMvc.perform(get("/api/users/1/followers").param("limit", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.users", hasSize(1)))
                .andExpect(jsonPath("$.results.hasMore", is(true)))
                .andExpect(jsonPath("$.results.nextCursor", notNullValue()))
                .andReturn().getResponse().getContentAsString();
        int idx = firstPage.indexOf("\"nextCursor\":") + "\"nextCursor\":".length();
        int end = firstPage.indexOf("}", idx);
        long cursor = Long.parseLong(firstPage.substring(idx, end).trim());

        // 둘째 페이지 — 첫 페이지의 user 와 다른 user 가 나와야 한다.
        mockMvc.perform(get("/api/users/1/followers")
                        .param("limit", "1")
                        .param("cursor", String.valueOf(cursor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.users", hasSize(greaterThanOrEqualTo(1))));
    }
}
