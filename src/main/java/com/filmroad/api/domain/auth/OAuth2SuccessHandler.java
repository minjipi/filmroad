package com.filmroad.api.domain.auth;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Component
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    /**
     * Deep link the Capacitor shell registers as an intent-filter
     * (Android: scheme=filmroad host=oauth path=/callback). Tokens are
     * delivered in the URL fragment so they don't leak into server access
     * logs or browser history persistence.
     */
    private static final String MOBILE_DEEP_LINK = "filmroad://oauth/callback";

    private final JwtTokenService jwtTokenService;
    private final String accessFormat;
    private final String refreshFormat;
    private final long accessMs;
    private final long refreshMs;
    private final String frontendBase;

    public OAuth2SuccessHandler(
            JwtTokenService jwtTokenService,
            @Value("${app.token.access-format}") String accessFormat,
            @Value("${app.token.refresh-format}") String refreshFormat,
            @Value("${app.token.access-max-age}") long accessMs,
            @Value("${app.token.refresh-max-age}") long refreshMs,
            @Value("${app.domain.server}") String frontendBase
    ) {
        this.jwtTokenService = jwtTokenService;
        this.accessFormat = accessFormat;
        this.refreshFormat = refreshFormat;
        this.accessMs = accessMs;
        this.refreshMs = refreshMs;
        this.frontendBase = frontendBase;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        boolean mobile = isMobileClient(request);

        Object principal = authentication.getPrincipal();
        if (!(principal instanceof OAuth2User oauth2User)) {
            getRedirectStrategy().sendRedirect(request, response,
                    mobile ? MOBILE_DEEP_LINK + "?err=oauth" : frontendBase + "/onboarding?err=oauth");
            return;
        }
        Object userIdRaw = oauth2User.getAttribute(CustomOAuth2UserService.ATTR_USER_ID);
        if (!(userIdRaw instanceof Number userIdNum)) {
            getRedirectStrategy().sendRedirect(request, response,
                    mobile ? MOBILE_DEEP_LINK + "?err=oauth" : frontendBase + "/onboarding?err=oauth");
            return;
        }
        Long userId = userIdNum.longValue();

        String accessToken = jwtTokenService.issueAccess(userId);
        String refreshToken = jwtTokenService.issueRefresh(userId);

        if (mobile) {
            // Custom Tabs and the in-app webview have separate cookie stores,
            // so cookies set here would never reach the app. Hand the tokens
            // over via the deep link fragment; the Capacitor `appUrlOpen`
            // listener mirrors them into webview localStorage + cookies.
            String url = MOBILE_DEEP_LINK
                    + "#access=" + UriUtils.encode(accessToken, StandardCharsets.UTF_8)
                    + "&refresh=" + UriUtils.encode(refreshToken, StandardCharsets.UTF_8);
            getRedirectStrategy().sendRedirect(request, response, url);
            return;
        }

        // Standard web flow — cookie-based session.
        // accessFormat·refreshFormat: "ATOKEN=%s; HttpOnly; Secure; SameSite=Strict; ...; Max-Age=%d"
        response.addHeader("Set-Cookie", String.format(accessFormat, accessToken, accessMs / 1000));
        response.addHeader("Set-Cookie", String.format(refreshFormat, refreshToken, refreshMs / 1000));

        getRedirectStrategy().sendRedirect(request, response, frontendBase + "/home?authed=1");
    }

    /**
     * Read the mobile flag stashed by MobileAwareOAuth2AuthorizationRequestResolver
     * at OAuth start time. Cleared on read so a subsequent web login on the
     * same session doesn't accidentally take the mobile branch.
     */
    private boolean isMobileClient(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) return false;
        Object flag = session.getAttribute(MobileAwareOAuth2AuthorizationRequestResolver.SESSION_FLAG);
        if (flag != null) session.removeAttribute(MobileAwareOAuth2AuthorizationRequestResolver.SESSION_FLAG);
        return MobileAwareOAuth2AuthorizationRequestResolver.APP_VALUE_MOBILE.equals(flag);
    }
}
