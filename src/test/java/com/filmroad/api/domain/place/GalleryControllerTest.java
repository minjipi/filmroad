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
                .andExpect(jsonPath("$.results.place.contentTitle", is("도깨비")))
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
        PlacePhoto entity = PlacePhoto.builder()
                .place(place10)
                .user(user2)
                .orderIndex(nextOrder)
                .caption("user2 비공개")
                .visibility(PhotoVisibility.PRIVATE)
                .build();
        entity.addImage(PlacePhotoImage.builder()
                .imageUrl("/uploads/private-user2.jpg")
                .imageOrderIndex(0)
                .build());
        PlacePhoto privatePhoto = placePhotoRepository.save(entity);

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

    @Test
    @DisplayName("liked: user=1 (시드 photo_like 보유) → photo 100 liked=true, 나머지 false")
    void getPhotos_loggedInOwnerLikes_setsLikedTrueForLikedRows() throws Exception {
        // 시드: photo_like 에 (user 1, photo 100) 레코드. place 10 사진 100/101/102/103 중 100 만 liked.
        mockMvc.perform(get("/api/places/10/photos")
                        .param("size", "50")
                        .cookie(new Cookie("ATOKEN", jwtTokenService.issueAccess(1L))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.photos[?(@.id == 100)].liked", hasItem(true)))
                .andExpect(jsonPath("$.results.photos[?(@.id == 101)].liked", hasItem(false)))
                .andExpect(jsonPath("$.results.photos[?(@.id == 102)].liked", hasItem(false)));
    }

    @Test
    @DisplayName("liked: 다른 유저 like 는 viewer 에게 영향 없음 (user=2 viewer → photo 100 liked=false)")
    void getPhotos_otherUserLikes_dontLeakAcrossViewers() throws Exception {
        // photo 100 은 user 1 이 좋아요. user 2 가 viewer 면 100 도 liked=false 여야 한다.
        mockMvc.perform(get("/api/places/10/photos")
                        .param("size", "50")
                        .cookie(new Cookie("ATOKEN", jwtTokenService.issueAccess(2L))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.photos[?(@.id == 100)].liked", hasItem(false)));
    }

    @Test
    @DisplayName("liked: 비로그인 viewer → 모든 photos 의 liked=false")
    void getPhotos_anonymous_allLikedFalse() throws Exception {
        mockMvc.perform(get("/api/places/10/photos").param("size", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.photos[*].liked",
                        everyItem(is(false))));
    }
}
