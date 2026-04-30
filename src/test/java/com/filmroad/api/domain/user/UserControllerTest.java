package com.filmroad.api.domain.user;

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
 * Integration tests for GET /api/users/me. Uses the seeded demo user (id=1).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenService jwtTokenService;

    private Cookie demoAccessCookie() {
        return new Cookie("ATOKEN", jwtTokenService.issueAccess(1L));
    }

    @Test
    @DisplayName("GET /api/users/me returns demo user profile with seeded stats and mini-map pins")
    void getMe_returnsSeededProfile() throws Exception {
        mockMvc.perform(get("/api/users/me").cookie(demoAccessCookie()))
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
        mockMvc.perform(get("/api/users/me").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.user.level", is(5)))
                .andExpect(jsonPath("$.results.user.levelName", is("성지 순례자")));
    }

    @Test
    @DisplayName("GET /api/users/me — trophies 4개 (4작품 MASTER), tier 와 percent=100 동반")
    void getMe_returnsTrophies() throws Exception {
        mockMvc.perform(get("/api/users/me").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.trophies", hasSize(4)))
                .andExpect(jsonPath("$.results.trophies[0].tier", is("MASTER")))
                .andExpect(jsonPath("$.results.trophies[0].percent", is(100)))
                .andExpect(jsonPath("$.results.trophies[0].contentTitle", notNullValue()))
                .andExpect(jsonPath("$.results.trophies[0].collectedCount", is(2)))
                .andExpect(jsonPath("$.results.trophies[0].totalCount", is(2)));
    }

    @Test
    @DisplayName("GET /api/users/me/photos → 본인 업로드 사진만 최신순(id DESC), 10개 이하면 nextCursor=null")
    void getMyPhotos_returnsOwnPhotosNewestFirst() throws Exception {
        // 시드상 user=1 의 사진 id: 100, 105, 113, 122, 131, 140, 145, 153, 162, 171 (10개). DESC 선두는 171.
        // default limit=30 > 10 이므로 한 페이지로 끝 → nextCursor = null.
        mockMvc.perform(get("/api/users/me/photos").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.photos", hasSize(10)))
                .andExpect(jsonPath("$.results.photos[0].id", is(171)))
                .andExpect(jsonPath("$.results.photos[0].placeId", is(17)))
                .andExpect(jsonPath("$.results.photos[0].regionLabel", notNullValue()))
                .andExpect(jsonPath("$.results.photos[0].contentTitle", notNullValue()))
                .andExpect(jsonPath("$.results.photos[0].visibility", is("PUBLIC")))
                .andExpect(jsonPath("$.results.nextCursor").value(nullValue()))
                // 다른 user 사진 (101=user2, 110=user2) 미포함 확인.
                .andExpect(jsonPath("$.results.photos[*].id", not(hasItem(is(101)))))
                .andExpect(jsonPath("$.results.photos[*].id", not(hasItem(is(110)))));
    }

    @Test
    @DisplayName("GET /api/users/me/photos?limit=3 → 3개 + nextCursor = 마지막 id (다음 페이지 있음)")
    void getMyPhotos_limitApplied_setsNextCursor() throws Exception {
        mockMvc.perform(get("/api/users/me/photos")
                        .param("limit", "3")
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.photos", hasSize(3)))
                .andExpect(jsonPath("$.results.photos[0].id", is(171)))
                .andExpect(jsonPath("$.results.photos[1].id", is(162)))
                .andExpect(jsonPath("$.results.photos[2].id", is(153)))
                // 총 10 개 중 3 개만 가져왔으므로 다음 페이지 있음.
                .andExpect(jsonPath("$.results.nextCursor", is(153)));
    }

    @Test
    @DisplayName("GET /api/users/me/photos?cursor=153&limit=3 → cursor 미만만 이어서 반환")
    void getMyPhotos_cursorPagination_continuesAfterCursor() throws Exception {
        mockMvc.perform(get("/api/users/me/photos")
                        .param("cursor", "153")
                        .param("limit", "3")
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                // 153 미만: 145, 140, 131, 122, 113, 105, 100 → 상위 3 = 145, 140, 131
                .andExpect(jsonPath("$.results.photos[0].id", is(145)))
                .andExpect(jsonPath("$.results.photos[1].id", is(140)))
                .andExpect(jsonPath("$.results.photos[2].id", is(131)))
                .andExpect(jsonPath("$.results.nextCursor", is(131)));
    }

    @Test
    @DisplayName("GET /api/users/me/photos?limit=999 → 상한 60 으로 clamp (user 1 은 10개라 상한과 무관하게 10 반환)")
    void getMyPhotos_limitClampedAt60() throws Exception {
        mockMvc.perform(get("/api/users/me/photos")
                        .param("limit", "999")
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.photos", hasSize(10)))
                .andExpect(jsonPath("$.results.nextCursor").value(nullValue()));
    }

    @Test
    @DisplayName("GET /api/users/me/photos 비로그인 → 401")
    void getMyPhotos_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/users/me/photos"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/users/me/liked-places → user=1 의 좋아요 5개를 PlaceLike id DESC 순으로 반환")
    void getMyLikedPlaces_returnsLikesNewestFirst() throws Exception {
        // data.sql: PlaceLike id 1..5 → place_id 10, 13, 14, 16, 17. id DESC 면 17, 16, 14, 13, 10.
        mockMvc.perform(get("/api/users/me/liked-places").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.places", hasSize(5)))
                .andExpect(jsonPath("$.results.places[0].id", is(17)))
                .andExpect(jsonPath("$.results.places[1].id", is(16)))
                .andExpect(jsonPath("$.results.places[2].id", is(14)))
                .andExpect(jsonPath("$.results.places[3].id", is(13)))
                .andExpect(jsonPath("$.results.places[4].id", is(10)))
                .andExpect(jsonPath("$.results.places[0].name", notNullValue()))
                .andExpect(jsonPath("$.results.places[0].regionLabel", notNullValue()))
                .andExpect(jsonPath("$.results.places[0].contentTitle", notNullValue()))
                .andExpect(jsonPath("$.results.places[0].likeCount", greaterThanOrEqualTo(0)))
                // 카드 썸네일 — coverImageUrls 의 0 번이 그리드에 노출되므로 비어있지 않아야.
                // place=17 시드는 cover 2장, place=10 은 3장 (data.sql 시드).
                .andExpect(jsonPath("$.results.places[0].coverImageUrls", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.results.places[0].coverImageUrls[0]", startsWith("https://")))
                .andExpect(jsonPath("$.results.places[4].coverImageUrls", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.results.nextCursor").value(nullValue()));
    }

    @Test
    @DisplayName("GET /api/users/me/liked-places?limit=2 → 상위 2개 + nextCursor = PlaceLike id (다음 페이지 있음)")
    void getMyLikedPlaces_limitApplied_setsNextCursor() throws Exception {
        // PlaceLike id 5, 4 → place 17, 16. 다음 페이지 cursor 는 PlaceLike id=4.
        mockMvc.perform(get("/api/users/me/liked-places")
                        .param("limit", "2")
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.places", hasSize(2)))
                .andExpect(jsonPath("$.results.places[0].id", is(17)))
                .andExpect(jsonPath("$.results.places[1].id", is(16)))
                .andExpect(jsonPath("$.results.nextCursor", is(4)));
    }

    @Test
    @DisplayName("GET /api/users/me/liked-places?cursor=4&limit=2 → cursor 미만 PlaceLike row 만 이어서 반환")
    void getMyLikedPlaces_cursorPagination_continuesAfterCursor() throws Exception {
        // cursor=4 → PlaceLike id 3, 2 → place 14, 13.
        mockMvc.perform(get("/api/users/me/liked-places")
                        .param("cursor", "4")
                        .param("limit", "2")
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.places", hasSize(2)))
                .andExpect(jsonPath("$.results.places[0].id", is(14)))
                .andExpect(jsonPath("$.results.places[1].id", is(13)))
                .andExpect(jsonPath("$.results.nextCursor", is(2)));
    }

    @Test
    @DisplayName("GET /api/users/me/liked-places 비로그인 → 401")
    void getMyLikedPlaces_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/users/me/liked-places"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/users/2 (auth) — 타 유저 공개 프로필: flat 필드 + stats + topPhotos + recentCollectedContents + following=true")
    void getPublicProfile_otherUser_returnsProfile() throws Exception {
        // 시드 user=2 (이서준). user=1 은 data.sql 의 user_follow 에서 user=2 를 팔로우 중.
        mockMvc.perform(get("/api/users/2").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.id", is(2)))
                .andExpect(jsonPath("$.results.nickname", is("이서준")))
                .andExpect(jsonPath("$.results.handle", is("@seojun")))
                .andExpect(jsonPath("$.results.levelName", notNullValue()))
                .andExpect(jsonPath("$.results.points", greaterThanOrEqualTo(0)))
                .andExpect(jsonPath("$.results.streakDays", greaterThanOrEqualTo(0)))
                .andExpect(jsonPath("$.results.stats.visitedCount", greaterThanOrEqualTo(0)))
                .andExpect(jsonPath("$.results.stats.photoCount", greaterThanOrEqualTo(0)))
                .andExpect(jsonPath("$.results.stats.collectedContentsCount", greaterThanOrEqualTo(0)))
                .andExpect(jsonPath("$.results.following", is(true)))
                .andExpect(jsonPath("$.results.isMe", is(false)))
                .andExpect(jsonPath("$.results.topPhotos", notNullValue()))
                .andExpect(jsonPath("$.results.recentCollectedContents", notNullValue()));
    }

    @Test
    @DisplayName("GET /api/users/1 (auth) — 본인 프로필: isMe=true, following=false + stats 수치 검증")
    void getPublicProfile_self_isMeTrue() throws Exception {
        mockMvc.perform(get("/api/users/1").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.id", is(1)))
                .andExpect(jsonPath("$.results.isMe", is(true)))
                .andExpect(jsonPath("$.results.following", is(false)))
                // 시드상 user=1 stamp 8개 (place 10,11,12,13,14,15,16,17 전부), 4개 작품 수집.
                .andExpect(jsonPath("$.results.stats.visitedCount", is(8)))
                .andExpect(jsonPath("$.results.stats.collectedContentsCount", is(4)));
    }

    @Test
    @DisplayName("GET /api/users/1 (공개 프로필) — trophies 도 함께 노출 (사회 증명)")
    void getPublicProfile_includesTrophies() throws Exception {
        mockMvc.perform(get("/api/users/1").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.trophies", hasSize(4)))
                .andExpect(jsonPath("$.results.trophies[0].tier", is("MASTER")));
    }

    @Test
    @DisplayName("GET /api/users/2 — stamp/trophy 없는 유저는 trophies=빈 배열")
    void getPublicProfile_noTrophies_returnsEmptyArray() throws Exception {
        mockMvc.perform(get("/api/users/2").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.trophies", hasSize(0)));
    }

    @Test
    @DisplayName("GET /api/users/2 (비로그인) — permitAll, isMe=false, following=false")
    void getPublicProfile_anonymous_returnsPublicView() throws Exception {
        mockMvc.perform(get("/api/users/2"))  // ATOKEN 쿠키 없음
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.id", is(2)))
                .andExpect(jsonPath("$.results.isMe", is(false)))
                .andExpect(jsonPath("$.results.following", is(false)));
    }

    @Test
    @DisplayName("GET /api/users/99999 — 없는 유저 → 404 USER_NOT_FOUND(40081)")
    void getPublicProfile_unknown_returns404() throws Exception {
        mockMvc.perform(get("/api/users/99999").cookie(demoAccessCookie()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is(40081)));
    }

    @Test
    @DisplayName("GET /api/users/1 — recentCollectedContents 엔트리에 collectedCount/totalCount 진행률 포함")
    void getPublicProfile_recentCollectedContents_hasProgress() throws Exception {
        // 시드 user=1 의 stamp 는 작품별 2건씩 → collectedCount=2, totalCount=2 (각 작품 place 2개).
        mockMvc.perform(get("/api/users/1").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.recentCollectedContents", not(empty())))
                .andExpect(jsonPath("$.results.recentCollectedContents[0].id", notNullValue()))
                .andExpect(jsonPath("$.results.recentCollectedContents[0].title", notNullValue()))
                .andExpect(jsonPath("$.results.recentCollectedContents[0].collectedCount", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.results.recentCollectedContents[0].totalCount", greaterThanOrEqualTo(1)));
    }
}