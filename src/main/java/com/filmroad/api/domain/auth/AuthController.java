package com.filmroad.api.domain.auth;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.auth.dto.AuthResponse;
import com.filmroad.api.domain.auth.dto.CheckEmailResponse;
import com.filmroad.api.domain.auth.dto.LoginRequest;
import com.filmroad.api.domain.auth.dto.SignUpRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final String accessFormat;
    private final String refreshFormat;
    private final long accessMs;
    private final long refreshMs;

    public AuthController(
            AuthService authService,
            @Value("${app.token.access-format}") String accessFormat,
            @Value("${app.token.refresh-format}") String refreshFormat,
            @Value("${app.token.access-max-age}") long accessMs,
            @Value("${app.token.refresh-max-age}") long refreshMs
    ) {
        this.authService = authService;
        this.accessFormat = accessFormat;
        this.refreshFormat = refreshFormat;
        this.accessMs = accessMs;
        this.refreshMs = refreshMs;
    }

    @PostMapping("/signup")
    public ResponseEntity<BaseResponse<AuthResponse>> signUp(@Valid @RequestBody SignUpRequest request,
                                                             HttpServletResponse response) {
        AuthService.AuthTokens tokens = authService.signUp(request);
        writeTokenCookies(response, tokens);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success(tokens.toResponse()));
    }

    @PostMapping("/login")
    public ResponseEntity<BaseResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request,
                                                            HttpServletResponse response) {
        AuthService.AuthTokens tokens = authService.login(request);
        writeTokenCookies(response, tokens);
        return ResponseEntity.ok(BaseResponse.success(tokens.toResponse()));
    }

    @GetMapping("/check-email")
    public BaseResponse<CheckEmailResponse> checkEmail(@RequestParam("email") String email) {
        return BaseResponse.success(authService.checkEmail(email));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletResponse response) {
        // 빈 값 + Max-Age=0 으로 쿠키 무효화.
        response.addHeader("Set-Cookie", String.format(accessFormat, "", 0));
        response.addHeader("Set-Cookie", String.format(refreshFormat, "", 0));
        return ResponseEntity.noContent().build();
    }

    private void writeTokenCookies(HttpServletResponse response, AuthService.AuthTokens tokens) {
        // OAuth2SuccessHandler 와 같은 포맷/만료로 ATOKEN·RTOKEN 쿠키를 내려보낸다.
        response.addHeader("Set-Cookie", String.format(accessFormat, tokens.accessToken(), accessMs / 1000));
        response.addHeader("Set-Cookie", String.format(refreshFormat, tokens.refreshToken(), refreshMs / 1000));
    }
}
