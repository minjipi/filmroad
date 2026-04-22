package com.filmroad.api.domain.auth;

import com.filmroad.api.domain.user.AuthProvider;
import com.filmroad.api.domain.user.User;
import com.filmroad.api.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * OAuth2 로그인 후 (provider, providerId)로 User upsert.
 * registrationId("google"/"kakao")로 분기하여 각 공급자의 attribute 구조에서 sub/email/nickname/picture 추출,
 * 공통 findOrCreateUser로 수렴.
 */
@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    static final String ATTR_USER_ID = "userId";
    private static final String NAME_KEY_GOOGLE = "sub";
    private static final String NAME_KEY_KAKAO = "id";

    private final UserRepository userRepository;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User raw = super.loadUser(userRequest);
        String registrationId = userRequest.getClientRegistration().getRegistrationId();
        Map<String, Object> attrs = raw.getAttributes();

        return switch (registrationId == null ? "" : registrationId.toLowerCase()) {
            case "google" -> handleGoogle(attrs);
            case "kakao" -> handleKakao(attrs);
            default -> throw new OAuth2AuthenticationException(new OAuth2Error("unsupported_provider"),
                    "Unsupported provider: " + registrationId);
        };
    }

    private OAuth2User handleGoogle(Map<String, Object> attrs) {
        String sub = String.valueOf(attrs.get("sub"));
        String email = (String) attrs.get("email");
        String name = (String) attrs.get("name");
        String picture = (String) attrs.get("picture");
        User user = findOrCreateUser(AuthProvider.GOOGLE, sub, email, name, picture);
        return buildPrincipal(attrs, user.getId(), NAME_KEY_GOOGLE);
    }

    @SuppressWarnings("unchecked")
    private OAuth2User handleKakao(Map<String, Object> attrs) {
        String sub = String.valueOf(attrs.get("id"));
        Map<String, Object> kakaoAccount = (Map<String, Object>) attrs.get("kakao_account");
        String email = kakaoAccount == null ? null : (String) kakaoAccount.get("email");
        Map<String, Object> profile = kakaoAccount == null ? null : (Map<String, Object>) kakaoAccount.get("profile");
        String nickname = profile == null ? null : (String) profile.get("nickname");
        String picture = profile == null ? null : (String) profile.get("profile_image_url");
        if (nickname == null || nickname.isBlank()) {
            nickname = "카카오 사용자";
        }
        User user = findOrCreateUser(AuthProvider.KAKAO, sub, email, nickname, picture);
        return buildPrincipal(attrs, user.getId(), NAME_KEY_KAKAO);
    }

    private User findOrCreateUser(AuthProvider provider, String providerId, String email, String nickname, String picture) {
        return userRepository.findByProviderAndProviderId(provider, providerId)
                .orElseGet(() -> userRepository.save(User.builder()
                        .provider(provider)
                        .providerId(providerId)
                        .email(email)
                        .nickname(nickname == null || nickname.isBlank() ? "여행자" : nickname)
                        .handle(generateHandle(email))
                        .avatarUrl(picture)
                        .level(1)
                        .points(0)
                        .streakDays(0)
                        .followersCount(0)
                        .followingCount(0)
                        .totalPhotoCount(0)
                        .build()));
    }

    private OAuth2User buildPrincipal(Map<String, Object> attrs, Long userId, String nameKey) {
        Map<String, Object> enriched = new HashMap<>(attrs);
        enriched.put(ATTR_USER_ID, userId);
        return new DefaultOAuth2User(List.of(), enriched, nameKey);
    }

    private String generateHandle(String email) {
        if (email != null && email.contains("@")) {
            String local = email.substring(0, email.indexOf('@'));
            if (!local.isBlank()) return "@" + local + "-" + shortId();
        }
        return "@user-" + shortId();
    }

    private String shortId() {
        return UUID.randomUUID().toString().substring(0, 6);
    }
}
