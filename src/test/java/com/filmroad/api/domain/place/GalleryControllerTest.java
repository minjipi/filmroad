package com.filmroad.api.domain.place;

import com.filmroad.api.domain.auth.JwtTokenService;
import com.filmroad.api.domain.user.User;
import com.filmroad.api.domain.user.UserRepository;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class GalleryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private PlacePhotoRepository placePhotoRepository;

    @Autowired
    private PlaceRepository placeRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Test
    @DisplayName("GET /api/places/10/photos returns paged gallery with header and default RECENT sort")
    void getPhotos_defaultSort_returnsRecentPage() throws Exception {
        mockMvc.perform(get("/api/places/10/photos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.place.placeId", is(10)))
                .andExpect(jsonPath("$.results.place.workTitle", is("도깨비")))
                .andExpect(jsonPath("$.results.photos", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.results.sort", is("RECENT")))
                .andExpect(jsonPath("$.results.total", greaterThanOrEqualTo(6)));
    }

    @Test
    @DisplayName("GET /api/places/10/photos?sort=POPULAR&size=3 returns 3 items with POPULAR sort")
    void getPhotos_popularSort_respectsSizeAndSort() throws Exception {
        mockMvc.perform(get("/api/places/10/photos")
                        .param("sort", "POPULAR")
                        .param("size", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.sort", is("POPULAR")))
                .andExpect(jsonPath("$.results.photos", hasSize(3)))
                .andExpect(jsonPath("$.results.size", is(3)));
    }

    @Test
    @DisplayName("GET /api/places/10/photos — 다른 유저가 올린 PRIVATE 사진은 viewer 에게 노출되지 않음")
    void getPhotos_privatePhotoByOtherUser_notVisible() throws Exception {
        // user=2 가 place 10 에 PRIVATE 사진 1건 업로드했다고 가정 (직접 저장).
        User user2 = userRepository.findById(2L).orElseThrow();
        Place place10 = placeRepository.findById(10L).orElseThrow();
        int nextOrder = placePhotoRepository.findMaxOrderIndexByPlaceId(10L) + 1;
        PlacePhoto privatePhoto = placePhotoRepository.save(PlacePhoto.builder()
                .place(place10)
                .user(user2)
                .imageUrl("/uploads/private-user2.jpg")
                .orderIndex(nextOrder)
                .caption("user2 비공개")
                .visibility(PhotoVisibility.PRIVATE)
                .build());

        // user=1 의 ATOKEN 으로 갤러리 조회 → 방금 저장한 PRIVATE 사진이 응답에 없어야 한다.
        mockMvc.perform(get("/api/places/10/photos")
                        .param("size", "50")
                        .cookie(new Cookie("ATOKEN", jwtTokenService.issueAccess(1L))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.photos[*].id",
                        not(hasItem(privatePhoto.getId().intValue()))));

        // user=2 본인은 자기 PRIVATE 사진을 볼 수 있어야 한다.
        mockMvc.perform(get("/api/places/10/photos")
                        .param("size", "50")
                        .cookie(new Cookie("ATOKEN", jwtTokenService.issueAccess(2L))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.photos[*].id",
                        hasItem(privatePhoto.getId().intValue())));
    }
}
