package com.filmroad.api.domain.place;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.filmroad.api.domain.auth.JwtTokenService;
import com.filmroad.api.domain.place.dto.PhotoUploadRequest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for POST /api/photos.
 *
 * Uses a real Spring context with H2 in-memory DB (MySQL compat mode) and the
 * test profile's /tmp upload path so MultipartFile transfers succeed.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class PhotoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private PlacePhotoRepository placePhotoRepository;

    @Autowired
    private PlaceRepository placeRepository;

    @Autowired
    private com.filmroad.api.domain.user.UserRepository userRepository;

    private Cookie demoAccessCookie() {
        return new Cookie("ATOKEN", jwtTokenService.issueAccess(1L));
    }

    private MockMultipartFile buildMeta(PhotoUploadRequest meta) throws Exception {
        return new MockMultipartFile(
                "meta", "meta.json", MediaType.APPLICATION_JSON_VALUE,
                objectMapper.writeValueAsBytes(meta));
    }

    // 실제 JPEG SOI 마커(FF D8 FF) 로 시작하는 최소 바이트. magic-byte 검증을 통과시킨다.
    private static final byte[] JPEG_BYTES = new byte[]{
            (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0,
            0, 0x10, 'J', 'F', 'I', 'F', 0, 1, 1, 0, 0, 0x48, 0, 0x48, 0, 0,
            (byte) 0xFF, (byte) 0xD9 // EOI
    };

    private MockMultipartFile buildImage() {
        return new MockMultipartFile(
                "file", "test.jpg", MediaType.IMAGE_JPEG_VALUE, JPEG_BYTES);
    }

    @Test
    @DisplayName("POST /api/photos with placeId=10 uploads image and persists PlacePhoto")
    void upload_validRequest_persistsPhoto() throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(10L, null, null, PhotoVisibility.PUBLIC, false);

        mockMvc.perform(multipart("/api/photos")
                        .file(buildImage())
                        .file(buildMeta(req))
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.code", is(20000)))
                .andExpect(jsonPath("$.results.placeId", is(10)))
                .andExpect(jsonPath("$.results.imageUrl", startsWith("/uploads/")))
                .andExpect(jsonPath("$.results.visibility", is("PUBLIC")))
                .andExpect(jsonPath("$.results.workId", is(1)));
    }

    @Test
    @DisplayName("POST /api/photos with unknown placeId returns PLACE_NOT_FOUND")
    void upload_unknownPlace_returnsNotFound() throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(99999L, null, null, PhotoVisibility.PUBLIC, false);

        mockMvc.perform(multipart("/api/photos")
                        .file(buildImage())
                        .file(buildMeta(req))
                        .cookie(demoAccessCookie()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(40050)));
    }

    @Test
    @DisplayName("POST /api/photos with .txt file returns INVALID_FILE_TYPE")
    void upload_invalidExtension_returnsValidationError() throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(10L, null, null, PhotoVisibility.PUBLIC, false);
        MockMultipartFile badFile = new MockMultipartFile(
                "file", "bad.txt", MediaType.TEXT_PLAIN_VALUE, "hello".getBytes());

        mockMvc.perform(multipart("/api/photos")
                        .file(badFile)
                        .file(buildMeta(req))
                        .cookie(demoAccessCookie()))
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(40060)));
    }

    @Test
    @DisplayName("POST /api/photos with caption + tags parses tags into list and persists caption")
    void upload_withCaptionAndTags_parsesAndPersists() throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(
                10L, "오늘의 인증샷", "도깨비, 강릉 , 인생샷,,  ", PhotoVisibility.FOLLOWERS, true);

        mockMvc.perform(multipart("/api/photos")
                        .file(buildImage())
                        .file(buildMeta(req))
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.caption", is("오늘의 인증샷")))
                .andExpect(jsonPath("$.results.visibility", is("FOLLOWERS")))
                .andExpect(jsonPath("$.results.tags", hasSize(3)))
                .andExpect(jsonPath("$.results.tags", contains("도깨비", "강릉", "인생샷")));
    }

    @Test
    @DisplayName("POST /api/photos — .jpg 확장자 + text/plain Content-Type 우회 시도 → 400 INVALID_FILE_TYPE")
    void upload_contentTypeBypass_returnsValidationError() throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(10L, null, null, PhotoVisibility.PUBLIC, false);
        MockMultipartFile suspicious = new MockMultipartFile(
                "file", "evil.jsp.jpg", MediaType.TEXT_PLAIN_VALUE, JPEG_BYTES);

        mockMvc.perform(multipart("/api/photos")
                        .file(suspicious)
                        .file(buildMeta(req))
                        .cookie(demoAccessCookie()))
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(40060)));
    }

    @Test
    @DisplayName("POST /api/photos — 확장자·Content-Type 은 이미지지만 magic byte 가 JPEG/PNG/WebP 가 아님 → 400")
    void upload_badMagicBytes_returnsValidationError() throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(10L, null, null, PhotoVisibility.PUBLIC, false);
        MockMultipartFile fakeImage = new MockMultipartFile(
                "file", "fake.jpg", MediaType.IMAGE_JPEG_VALUE,
                new byte[]{0x00, 0x00, 0x00, 0x00, 0x00, 0x00});

        mockMvc.perform(multipart("/api/photos")
                        .file(fakeImage)
                        .file(buildMeta(req))
                        .cookie(demoAccessCookie()))
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(40060)));
    }

    @Test
    @DisplayName("GET /api/photos/{id} — 공개 PUBLIC 사진은 비로그인도 200, place/work/author/comments 블록 포함")
    void getPhoto_publicSeed_returnsDetail() throws Exception {
        // 시드 photo 100 은 place 10(주문진 영진해변), work 1(도깨비), user_id=1, visibility=PUBLIC.
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/photos/100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.id", is(100)))
                .andExpect(jsonPath("$.results.imageUrl", notNullValue()))
                .andExpect(jsonPath("$.results.visibility", is("PUBLIC")))
                .andExpect(jsonPath("$.results.place.id", is(10)))
                .andExpect(jsonPath("$.results.place.name", is("주문진 영진해변 방파제")))
                .andExpect(jsonPath("$.results.work.id", is(1)))
                .andExpect(jsonPath("$.results.work.title", is("도깨비")))
                .andExpect(jsonPath("$.results.author.id", is(1)))
                // isMe 는 viewer 기준. CurrentUser 가 DEMO_USER_ID=1 로 fallback 해서 author(1) == viewer(1) 이 되므로 true.
                .andExpect(jsonPath("$.results.author.isMe", is(true)))
                .andExpect(jsonPath("$.results.comments", notNullValue()));
    }

    @Test
    @DisplayName("GET /api/photos/{id} — 내 PRIVATE 사진은 owner 본인에게 200")
    void getPhoto_ownPrivate_allowedForOwner() throws Exception {
        // 직접 user=1 소유 PRIVATE 사진을 저장.
        com.filmroad.api.domain.user.User u1 = userRepository.findById(1L).orElseThrow();
        Place p = placeRepository.findById(10L).orElseThrow();
        int nextOrder = placePhotoRepository.findMaxOrderIndexByPlaceId(10L) + 1;
        PlacePhoto own = placePhotoRepository.save(PlacePhoto.builder()
                .place(p).user(u1)
                .imageUrl("/uploads/own-private.jpg")
                .orderIndex(nextOrder)
                .visibility(PhotoVisibility.PRIVATE)
                .build());

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(
                        "/api/photos/" + own.getId())
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.visibility", is("PRIVATE")))
                .andExpect(jsonPath("$.results.author.isMe", is(true)));
    }

    @Test
    @DisplayName("GET /api/photos/{id} — 다른 유저의 PRIVATE 사진은 404 로 숨김 (enumeration 방지)")
    void getPhoto_foreignPrivate_returns404() throws Exception {
        // user=2 가 올린 PRIVATE 사진 1건.
        com.filmroad.api.domain.user.User u2 = userRepository.findById(2L).orElseThrow();
        Place p = placeRepository.findById(10L).orElseThrow();
        int nextOrder = placePhotoRepository.findMaxOrderIndexByPlaceId(10L) + 1;
        PlacePhoto foreign = placePhotoRepository.save(PlacePhoto.builder()
                .place(p).user(u2)
                .imageUrl("/uploads/u2-private.jpg")
                .orderIndex(nextOrder)
                .visibility(PhotoVisibility.PRIVATE)
                .build());

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(
                        "/api/photos/" + foreign.getId())
                        .cookie(demoAccessCookie()))   // user=1 토큰
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is(40070)));
    }

    @Test
    @DisplayName("GET /api/photos/99999 (없음) → 404 PHOTO_NOT_FOUND")
    void getPhoto_unknownId_returns404() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/photos/99999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is(40070)));
    }

    @Test
    @DisplayName("POST /api/photos — DB 에 저장된 PlacePhoto row 의 user_id 가 로그인 유저(1)로 채워짐 (회귀 방지)")
    void upload_persistsUploaderUserId() throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(10L, "회귀 테스트", null, PhotoVisibility.PUBLIC, false);

        MvcResult result = mockMvc.perform(multipart("/api/photos")
                        .file(buildImage())
                        .file(buildMeta(req))
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andReturn();

        // 응답 body 에서 방금 저장한 PlacePhoto id 추출.
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        long photoId = body.at("/results/id").asLong();
        assertThat(photoId).isGreaterThan(0);

        // Hibernate 로 다시 fetch 해 user_id 컬럼이 실제로 채워졌는지 확정.
        PlacePhoto persisted = placePhotoRepository.findById(photoId).orElseThrow();
        assertThat(persisted.getUser())
                .as("PlacePhoto.user 는 NOT NULL 이어야 하고 current user 와 일치해야 함")
                .isNotNull();
        assertThat(persisted.getUser().getId()).isEqualTo(1L);
    }

    @Test
    @DisplayName("POST /api/photos returns stamp + reward deltas including pointsEarned=50")
    void upload_returnsStampAndReward() throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(10L, null, null, PhotoVisibility.PUBLIC, false);

        mockMvc.perform(multipart("/api/photos")
                        .file(buildImage())
                        .file(buildMeta(req))
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.stamp.workTitle", is("도깨비")))
                .andExpect(jsonPath("$.results.stamp.totalCount", greaterThan(0)))
                .andExpect(jsonPath("$.results.reward.pointsEarned", is(50)))
                .andExpect(jsonPath("$.results.reward.levelName", notNullValue()))
                .andExpect(jsonPath("$.results.reward.newBadges", notNullValue()));
    }
}
