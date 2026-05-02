package com.filmroad.api.domain.auth;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

/**
 * Carries the `?app=mobile` flag from the OAuth start request through to the
 * success handler. Native (Capacitor) clients launch the authorization URL
 * in Custom Tabs/SFSafariViewController whose cookie store is separate from
 * the in-app webview, so the success handler must redirect to a
 * `filmroad://oauth/callback#access=...&refresh=...` deep link instead of
 * the standard web success page.
 *
 * The attribute is stashed on the HTTP session — Spring Security's default
 * `OAuth2AuthorizationRequestRedirectFilter` already creates one for the
 * authorization request even under STATELESS policy, so we piggyback on it
 * rather than introducing a parallel cookie/store.
 */
public class MobileAwareOAuth2AuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

    public static final String APP_PARAM = "app";
    public static final String APP_VALUE_MOBILE = "mobile";
    public static final String SESSION_FLAG = "filmroad.oauth.app";

    private final DefaultOAuth2AuthorizationRequestResolver delegate;

    public MobileAwareOAuth2AuthorizationRequestResolver(
            ClientRegistrationRepository clientRegistrationRepository,
            String authorizationRequestBaseUri
    ) {
        this.delegate = new DefaultOAuth2AuthorizationRequestResolver(
                clientRegistrationRepository, authorizationRequestBaseUri);
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        return augment(request, delegate.resolve(request));
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
        return augment(request, delegate.resolve(request, clientRegistrationId));
    }

    private OAuth2AuthorizationRequest augment(HttpServletRequest request, OAuth2AuthorizationRequest base) {
        if (base == null) return null;
        String app = request.getParameter(APP_PARAM);
        if (APP_VALUE_MOBILE.equalsIgnoreCase(app)) {
            // getSession(true) — Spring Security would create one anyway for the
            // authorization request repository; making it explicit guarantees
            // the flag is there when the callback runs.
            request.getSession(true).setAttribute(SESSION_FLAG, APP_VALUE_MOBILE);
        }
        return base;
    }
}
