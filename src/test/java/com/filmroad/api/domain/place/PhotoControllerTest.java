package com.filmroad.api.domain.place;

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
import org.springframework.transaction.annotation.Transactional;

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

    private Cookie demoAccessCookie() {
        return new Cookie("ATOKEN", jwtTokenService.issueAccess(1L));
    }

    private MockMultipartFile buildMeta(PhotoUploadRequest meta) throws Exception {
        return new MockMultipartFile(
                "meta", "meta.json", MediaType.APPLICATION_JSON_VALUE,
                objectMapper.writeValueAsBytes(meta));
    }

    private MockMultipartFile buildImage() {
        return new MockMultipartFile(
                "file", "test.jpg", MediaType.IMAGE_JPEG_VALUE, new byte[]{1, 2, 3, 4});
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
