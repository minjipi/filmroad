package com.filmroad.api.domain.auth;

import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.auth.dto.AuthResponse;
import com.filmroad.api.domain.auth.dto.CheckEmailResponse;
import com.filmroad.api.domain.auth.dto.LoginRequest;
import com.filmroad.api.domain.auth.dto.SignUpRequest;
import com.filmroad.api.domain.user.AuthProvider;
import com.filmroad.api.domain.user.User;
import com.filmroad.api.domain.user.UserRepository;
import com.filmroad.api.domain.user.dto.UserMeDto;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 이메일 회원가입/로그인/중복확인 비즈니스 로직.
 * JWT 발급은 {@link JwtTokenService} 에 위임하고, 쿠키 세팅은 호출자(Controller)가 담당.
 * OAuth 경로({@link CustomOAuth2UserService})와 달리 password_hash 컬럼을 채워 비밀번호 검증을 지원.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    // 간이 이메일 형식 검증. @Email 어노테이션과 동일한 기본 규칙 수준.
    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[A-Za-z0-9+._%-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;

    public record AuthTokens(User user, String accessToken, String refreshToken) {
        public AuthResponse toResponse() {
            return AuthResponse.builder()
                    .accessToken(accessToken)
                    .user(UserMeDto.from(user))
                    .build();
        }
    }

    @Transactional
    public AuthTokens signUp(SignUpRequest req) {
        String email = normalizeEmail(req.getEmail());

        // 모든 provider 공통으로 이메일 중복을 막는다. OAuth 로 이미 가입한 이메일도 중복으로 본다.
        if (userRepository.existsByEmail(email)) {
            throw BaseException.of(BaseResponseStatus.DUPLICATE_USER_EMAIL);
        }

        User user = userRepository.save(User.builder()
                .provider(AuthProvider.EMAIL)
                .providerId(null)
                .email(email)
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .nickname(req.getName().trim())
                .handle(generateHandle(email))
                .level(1)
                .points(0)
                .streakDays(0)
                .followersCount(0)
                .followingCount(0)
                .totalPhotoCount(0)
                .build());

        return issueTokens(user);
    }

    @Transactional(readOnly = true)
    public AuthTokens login(LoginRequest req) {
        String email = normalizeEmail(req.getEmail());

        User user = userRepository.findByEmailAndProvider(email, AuthProvider.EMAIL)
                // 존재하지 않는 이메일이든 비밀번호 오류든 동일한 응답으로 내려 보안적으로 동일하게 처리.
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.INVALID_USER_INFO));

        if (user.getPasswordHash() == null
                || !passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw BaseException.of(BaseResponseStatus.INVALID_USER_INFO);
        }

        return issueTokens(user);
    }

    @Transactional(readOnly = true)
    public CheckEmailResponse checkEmail(String rawEmail) {
        String email = normalizeEmail(rawEmail);
        if (!EMAIL_PATTERN.matcher(email).matches()) {
            // 형식이 잘못된 이메일은 400 으로 응답 (INVALID_USER_EMAIL = 20010 → 400).
            throw BaseException.of(BaseResponseStatus.INVALID_USER_EMAIL);
        }
        boolean available = !userRepository.existsByEmail(email);
        return CheckEmailResponse.builder()
                .available(available)
                .build();
    }

    private AuthTokens issueTokens(User user) {
        String accessToken = jwtTokenService.issueAccess(user.getId());
        String refreshToken = jwtTokenService.issueRefresh(user.getId());
        return new AuthTokens(user, accessToken, refreshToken);
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            throw BaseException.of(BaseResponseStatus.INVALID_USER_EMAIL);
        }
        String trimmed = email.trim().toLowerCase();
        if (trimmed.isEmpty()) {
            throw BaseException.of(BaseResponseStatus.INVALID_USER_EMAIL);
        }
        return trimmed;
    }

    /**
     * CustomOAuth2UserService 와 동일한 규칙으로 @handle 생성. 길이 60 제약 고려해 local 파트는 24자로 잘라낸다.
     */
    private String generateHandle(String email) {
        String local = email.substring(0, email.indexOf('@'));
        if (local.length() > 24) local = local.substring(0, 24);
        String safeLocal = local.replaceAll("[^A-Za-z0-9._-]", "");
        if (safeLocal.isBlank()) safeLocal = "user";
        return "@" + safeLocal + "-" + UUID.randomUUID().toString().substring(0, 6);
    }
}
