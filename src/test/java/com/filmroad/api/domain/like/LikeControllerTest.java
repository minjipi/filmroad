package com.filmroad.api.domain.like;

import com.filmroad.api.domain.auth.JwtTokenService;
import com.filmroad.api.domain.place.PhotoVisibility;
import com.filmroad.api.domain.place.PlacePhoto;
import com.filmroad.api.domain.place.PlacePhotoRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class LikeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private PlacePhotoRepository placePhotoRepository;

    private Cookie demoAccessCookie() {
        return new Cookie("ATOKEN", jwtTokenService.issueAccess(1L));
    }

    private Cookie accessCookieFor(long userId) {
        return new Cookie("ATOKEN", jwtTokenService.issueAccess(userId));
    }

    @Test
    @DisplayName("POST /api/places/12/like twice flips liked state and likeCount delta net-zero")
    void togglePlaceLike_twice_flipsState() throws Exception {
        // place 12는 seed place_like에 없어 초기 상태 liked=false.
        mockMvc.perform(post("/api/places/12/like").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.liked", is(true)))
                .andExpect(jsonPath("$.results.likeCount", greaterThan(0)));

        mockMvc.perform(post("/api/places/12/like").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.liked", is(false)));
    }

    @Test
    @DisplayName("POST /api/photos/101/like twice flips liked state")
    void togglePhotoLike_twice_flipsState() throws Exception {
        mockMvc.perform(post("/api/photos/101/like").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.liked", is(true)));

        mockMvc.perform(post("/api/photos/101/like").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.liked", is(false)));
    }

    @Test
    @DisplayName("POST /api/places/12/like without ATOKEN returns 401")
    void togglePlaceLike_unauthenticated_returns401() throws Exception {
        mockMvc.perform(post("/api/places/12/like"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/photos/101/like without ATOKEN returns 401")
    void togglePhotoLike_unauthenticated_returns401() throws Exception {
        mockMvc.perform(post("/api/photos/101/like"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/photos/{id}/like — 비작성자가 PRIVATE 사진에 직접 호출 → PHOTO_NOT_FOUND(40070)")
    void togglePhotoLike_privatePhoto_byNonOwner_returnsNotFound() throws Exception {
        // photo 100 은 user 1 소유 시드. PRIVATE 으로 바꾼 뒤 user 2 로 like 시도.
        PlacePhoto photo = placePhotoRepository.findById(100L).orElseThrow();
        photo.updateContent(photo.getCaption(), PhotoVisibility.PRIVATE);
        placePhotoRepository.save(photo);

        mockMvc.perform(post("/api/photos/100/like").cookie(accessCookieFor(2L)))
                .andExpect(status().is4xxClientError())
                .andExpect(jsonPath("$.code", is(40070)));
    }

    @Test
    @DisplayName("POST /api/photos/{id}/like — 작성자 본인이면 PRIVATE 사진에도 like 가능")
    void togglePhotoLike_privatePhoto_byOwner_succeeds() throws Exception {
        PlacePhoto photo = placePhotoRepository.findById(100L).orElseThrow();
        photo.updateContent(photo.getCaption(), PhotoVisibility.PRIVATE);
        placePhotoRepository.save(photo);

        mockMvc.perform(post("/api/photos/100/like").cookie(demoAccessCookie())) // user 1
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));
    }
}
