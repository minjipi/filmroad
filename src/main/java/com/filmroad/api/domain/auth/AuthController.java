package com.filmroad.api.domain.auth;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final String accessFormat;
    private final String refreshFormat;

    public AuthController(
            @Value("${app.token.access-format}") String accessFormat,
            @Value("${app.token.refresh-format}") String refreshFormat
    ) {
        this.accessFormat = accessFormat;
        this.refreshFormat = refreshFormat;
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletResponse response) {
        // 빈 값 + Max-Age=0 으로 쿠키 무효화.
        response.addHeader("Set-Cookie", String.format(accessFormat, "", 0));
        response.addHeader("Set-Cookie", String.format(refreshFormat, "", 0));
        return ResponseEntity.noContent().build();
    }
}
