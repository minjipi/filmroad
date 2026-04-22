package com.filmroad.api.domain.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * JWT access/refresh 토큰 발급 · 검증. HS256 기반, 쿠키에 그대로 실어 전송.
 */
@Service
public class JwtTokenService {

    private final SecretKey key;
    private final long accessMs;
    private final long refreshMs;

    public JwtTokenService(
            @Value("${jwt.secret.key}") String secret,
            @Value("${app.token.access-max-age}") long accessMs,
            @Value("${app.token.refresh-max-age}") long refreshMs
    ) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessMs = accessMs;
        this.refreshMs = refreshMs;
    }

    public String issueAccess(Long userId) {
        return issue(userId, accessMs);
    }

    public String issueRefresh(Long userId) {
        return issue(userId, refreshMs);
    }

    public Long parseUserId(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        Object raw = claims.get("userId");
        if (raw instanceof Number n) return n.longValue();
        if (raw instanceof String s) return Long.parseLong(s);
        throw new IllegalStateException("userId claim missing");
    }

    // 짧은 만료를 강제 지정해 만료 케이스를 테스트할 때만 사용.
    String issueWithTtl(Long userId, long ttlMs) {
        return issue(userId, ttlMs);
    }

    private String issue(Long userId, long ttlMs) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("userId", userId)
                .issuedAt(new Date(now))
                .expiration(new Date(now + ttlMs))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }
}
