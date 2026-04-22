package com.filmroad.api.domain.auth;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

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
        Object principal = authentication.getPrincipal();
        if (!(principal instanceof OAuth2User oauth2User)) {
            getRedirectStrategy().sendRedirect(request, response, frontendBase + "/onboarding?err=oauth");
            return;
        }
        Object userIdRaw = oauth2User.getAttribute(CustomOAuth2UserService.ATTR_USER_ID);
        if (!(userIdRaw instanceof Number userIdNum)) {
            getRedirectStrategy().sendRedirect(request, response, frontendBase + "/onboarding?err=oauth");
            return;
        }
        Long userId = userIdNum.longValue();

        String accessToken = jwtTokenService.issueAccess(userId);
        String refreshToken = jwtTokenService.issueRefresh(userId);

        // accessFormat·refreshFormat: "ATOKEN=%s; HttpOnly; Secure; SameSite=Strict; ...; Max-Age=%d"
        response.addHeader("Set-Cookie", String.format(accessFormat, accessToken, accessMs / 1000));
        response.addHeader("Set-Cookie", String.format(refreshFormat, refreshToken, refreshMs / 1000));

        getRedirectStrategy().sendRedirect(request, response, frontendBase + "/home?authed=1");
    }
}
