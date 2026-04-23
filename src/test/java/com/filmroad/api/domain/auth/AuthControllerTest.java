package com.filmroad.api.domain.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Test
    @DisplayName("POST /api/auth/logout returns 204 with Max-Age=0 cookies")
    void logout_clearsCookies() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isNoContent())
                .andReturn();

        java.util.List<String> setCookies = result.getResponse().getHeaders("Set-Cookie");
        assertThat(setCookies).hasSize(2);
        assertThat(setCookies).anyMatch(h -> h.startsWith("ATOKEN=") && h.contains("Max-Age=0"));
        assertThat(setCookies).anyMatch(h -> h.startsWith("RTOKEN=") && h.contains("Max-Age=0"));
    }

    @Test
    @Transactional
    @DisplayName("signup → check-email → login happy path: 201 + ATOKEN 쿠키 + 같은 비번으로 200 로그인")
    void signupThenLogin_issuesSessionCookies() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "김소연",
                "email", "Soyeon+Test@Film.com",
                "password", "filmroad1234"
        ));

        MvcResult signup = mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.user.id", notNullValue()))
                .andExpect(jsonPath("$.results.user.nickname", is("김소연")))
                .andExpect(jsonPath("$.results.user.email", is("soyeon+test@film.com")))
                .andReturn();

        java.util.List<String> setCookies = signup.getResponse().getHeaders("Set-Cookie");
        assertThat(setCookies).anyMatch(h -> h.startsWith("ATOKEN=") && !h.contains("Max-Age=0"));
        assertThat(setCookies).anyMatch(h -> h.startsWith("RTOKEN=") && !h.contains("Max-Age=0"));

        // check-email 은 이미 가입된 이메일에 대해 available=false, 바디는 `{available}` 만 포함.
        mockMvc.perform(get("/api/auth/check-email").param("email", "soyeon+test@film.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.available", is(false)))
                .andExpect(jsonPath("$.results.email").doesNotExist());

        // 로그인은 대소문자/이메일 정규화 후 성공.
        String loginBody = objectMapper.writeValueAsString(Map.of(
                "email", "soyeon+test@film.com",
                "password", "filmroad1234"
        ));
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.user.nickname", is("김소연")));
    }

    @Test
    @Transactional
    @DisplayName("중복 이메일 signup → 409 DUPLICATE_USER_EMAIL(20006)")
    void signup_duplicateEmail_returns409() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "최초가입자",
                "email", "dup@example.com",
                "password", "password12"
        ));
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());

        String second = objectMapper.writeValueAsString(Map.of(
                "name", "나중가입자",
                "email", "DUP@example.com", // 대소문자 달라도 중복으로 간주
                "password", "password34"
        ));
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(second))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(20006)));
    }

    @Test
    @DisplayName("비밀번호 정책 위반 signup → 400 REQUEST_ERROR(30001)")
    void signup_weakPassword_returns400() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "테스트",
                "email", "weakpw@example.com",
                "password", "onlyletters"
        ));

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is(30001)));
    }

    @Test
    @Transactional
    @DisplayName("잘못된 비밀번호 로그인 → 401 INVALID_USER_INFO(20004)")
    void login_wrongPassword_returns401() throws Exception {
        String signupBody = objectMapper.writeValueAsString(Map.of(
                "name", "테스트2",
                "email", "login-fail@example.com",
                "password", "correctpw12"
        ));
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupBody))
                .andExpect(status().isCreated());

        String loginBody = objectMapper.writeValueAsString(Map.of(
                "email", "login-fail@example.com",
                "password", "wrongpw1234"
        ));
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code", is(20004)));
    }

    @Test
    @DisplayName("GET /api/auth/check-email 형식 오류 → 400 INVALID_USER_EMAIL(20010)")
    void checkEmail_invalidFormat_returns400() throws Exception {
        mockMvc.perform(get("/api/auth/check-email").param("email", "not-an-email"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is(20010)));
    }

    @Test
    @DisplayName("POST /api/auth/refresh — 유효 RTOKEN 쿠키 → 200 + 새 ATOKEN/RTOKEN 쿠키 + body accessToken")
    void refresh_withValidRtoken_reissuesTokens() throws Exception {
        // 시드상 user id=1 이 항상 존재 (data.sql 참조).
        String rtoken = jwtTokenService.issueRefresh(1L);

        MvcResult result = mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie("RTOKEN", rtoken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.user.id", is(1)))
                .andExpect(jsonPath("$.results.accessToken", notNullValue()))
                .andReturn();

        java.util.List<String> setCookies = result.getResponse().getHeaders("Set-Cookie");
        assertThat(setCookies).anyMatch(h -> h.startsWith("ATOKEN=") && !h.contains("Max-Age=0"));
        assertThat(setCookies).anyMatch(h -> h.startsWith("RTOKEN=") && !h.contains("Max-Age=0"));
    }

    @Test
    @DisplayName("POST /api/auth/refresh — RTOKEN 쿠키 없음 → 401 INVALID_USER_INFO(20004)")
    void refresh_missingRtoken_returns401() throws Exception {
        mockMvc.perform(post("/api/auth/refresh"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code", is(20004)));
    }

    @Test
    @DisplayName("POST /api/auth/refresh — 위조 RTOKEN → 401 + Max-Age=0 쿠키 2개")
    void refresh_tamperedRtoken_returns401AndClearsCookies() throws Exception {
        String tampered = jwtTokenService.issueRefresh(1L) + "garbage";

        MvcResult result = mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie("RTOKEN", tampered)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code", is(20004)))
                .andReturn();

        java.util.List<String> setCookies = result.getResponse().getHeaders("Set-Cookie");
        assertThat(setCookies).anyMatch(h -> h.startsWith("ATOKEN=") && h.contains("Max-Age=0"));
        assertThat(setCookies).anyMatch(h -> h.startsWith("RTOKEN=") && h.contains("Max-Age=0"));
    }

    @Test
    @DisplayName("POST /api/auth/refresh — 만료된 RTOKEN → 401")
    void refresh_expiredRtoken_returns401() throws Exception {
        // TTL=1ms 로 발급 후 sleep 하면 expired 상태가 된다 (JwtTokenServiceTest 와 동일 패턴).
        String expired = jwtTokenService.issueWithTtl(1L, 1L);
        Thread.sleep(20);

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie("RTOKEN", expired)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code", is(20004)));
    }

    @Test
    @DisplayName("POST /api/auth/refresh — 존재하지 않는 userId 의 RTOKEN → 401")
    void refresh_unknownUser_returns401() throws Exception {
        String rtokenForGhost = jwtTokenService.issueRefresh(999_999L);

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie("RTOKEN", rtokenForGhost)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code", is(20004)));
    }
}
