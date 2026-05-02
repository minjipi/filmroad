package com.filmroad.api.config;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.auth.CustomOAuth2UserService;
import com.filmroad.api.domain.auth.JwtAuthenticationFilter;
import com.filmroad.api.domain.auth.MobileAwareOAuth2AuthorizationRequestResolver;
import com.filmroad.api.domain.auth.OAuth2SuccessHandler;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CustomOAuth2UserService customOAuth2UserService;
    private final OAuth2SuccessHandler oauth2SuccessHandler;
    private final ObjectMapper objectMapper;
    private final ClientRegistrationRepository clientRegistrationRepository;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/logout").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/signup", "/api/auth/login", "/api/auth/refresh").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/route/directions").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/route/init").permitAll()
                        .requestMatchers("/api/route/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/auth/check-email").permitAll()
                        .requestMatchers(HttpMethod.GET,
                                "/api/home",
                                "/api/map/places",
                                "/api/places/*",
                                "/api/places/*/kakao-info",
                                "/api/places/*/nearby-restaurants",
                                "/api/places/*/congestion",
                                "/api/places/*/photos",
                                "/api/photos/*",
                                "/api/photos/*/comments",
                                "/api/contents/*",
                                "/api/feed",
                                "/api/feed/**",
                                "/api/search",
                                "/uploads/**",
                                "/swagger-ui/**",
                                "/v3/api-docs/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/places/*/like").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/users/*/follow").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/comments/*").authenticated()
                        // `/api/users/me` 와 `/me/photos` 는 auth. `/api/users/{id}` 는 permitAll (공개 프로필).
                        // 순서가 중요 — Spring Security 는 첫 매치 승자이므로 구체적인 `/me` 를 먼저 둔다.
                        .requestMatchers(HttpMethod.GET, "/api/users/me", "/api/users/me/photos", "/api/users/me/liked-places").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/users/*",
                                "/api/users/*/followers",
                                "/api/users/*/following").permitAll()
                        .requestMatchers("/api/users/**",
                                "/api/saved/**",
                                "/api/photos",
                                "/api/photos/**",
                                "/api/stampbook").authenticated()
                        .anyRequest().permitAll()
                )
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint((request, response, ex) -> {
                            response.setStatus(401);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.setCharacterEncoding("UTF-8");
                            response.getWriter().write(objectMapper.writeValueAsString(
                                    BaseResponse.error(BaseResponseStatus.INVALID_JWT)));
                        })
                )
                .oauth2Login(oauth -> oauth
                        .authorizationEndpoint(ae -> ae.authorizationRequestResolver(
                                new MobileAwareOAuth2AuthorizationRequestResolver(
                                        clientRegistrationRepository,
                                        "/oauth2/authorization")))
                        .userInfoEndpoint(ui -> ui.userService(customOAuth2UserService))
                        .successHandler(oauth2SuccessHandler)
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    // Spring Boot는 @Component Filter를 서블릿 체인에 자동 등록. 보안 체인에만 쓰도록 비활성화.
    @Bean
    public FilterRegistrationBean<JwtAuthenticationFilter> jwtFilterRegistrationDisable(JwtAuthenticationFilter filter) {
        FilterRegistrationBean<JwtAuthenticationFilter> reg = new FilterRegistrationBean<>(filter);
        reg.setEnabled(false);
        return reg;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
                "http://localhost:5173",
                "http://172.30.1.10:5173",
                "https://www.filmroad.kro.kr",
                "http://localhost:5174",
                "http://localhost",
                "https://localhost",       // Capacitor Android (androidScheme=https default)
                "capacitor://localhost"    // Capacitor iOS
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
