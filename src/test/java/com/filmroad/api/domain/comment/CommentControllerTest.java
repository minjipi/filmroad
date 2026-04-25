package com.filmroad.api.domain.comment;

import com.filmroad.api.domain.auth.JwtTokenService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class CommentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenService jwtTokenService;

    private Cookie userCookie(long userId) {
        return new Cookie("ATOKEN", jwtTokenService.issueAccess(userId));
    }

    /** 유효한 JPEG magic-byte 를 가진 최소 바이트 페이로드. PhotoUploadService 검증 통과용. */
    private static byte[] jpegBytes() {
        // SOI(0xFF 0xD8 0xFF) + 패딩.
        byte[] head = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0,
                0x00, 0x10, 'J', 'F', 'I', 'F', 0x00, 0x01, 0x01, 0x00};
        return head;
    }

    private static byte[] pngBytes() {
        // PNG 시그니처 89 50 4E 47 0D 0A 1A 0A.
        return new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A,
                0x00, 0x00, 0x00, 0x0D};
    }

    @Test
    @DisplayName("POST /api/photos/100/comments multipart with text only returns CommentDto, imageUrl null")
    void createComment_textOnly_imageUrlNull() throws Exception {
        mockMvc.perform(multipart("/api/photos/100/comments")
                        .param("content", "좋은 사진이네요")
                        .contentType(MediaType.MULTIPART_FORM_DATA)
                        .cookie(userCookie(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.content", is("좋은 사진이네요")))
                .andExpect(jsonPath("$.results.imageUrl", is(nullValue())))
                .andExpect(jsonPath("$.results.author.userId", is(1)));
    }

    @Test
    @DisplayName("POST /api/photos/100/comments with image part returns imageUrl pointing under /uploads/comments/")
    void createComment_withImage_returnsImageUrl() throws Exception {
        MockMultipartFile image = new MockMultipartFile(
                "image", "verify.jpg", "image/jpeg", jpegBytes()
        );

        mockMvc.perform(multipart("/api/photos/100/comments")
                        .file(image)
                        .param("content", "여기 진짜로 다녀왔어요")
                        .contentType(MediaType.MULTIPART_FORM_DATA)
                        .cookie(userCookie(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.content", is("여기 진짜로 다녀왔어요")))
                .andExpect(jsonPath("$.results.imageUrl", startsWith("/uploads/comments/")))
                .andExpect(jsonPath("$.results.imageUrl", endsWith(".jpg")));
    }

    @Test
    @DisplayName("POST /api/photos/100/comments without ATOKEN returns 401")
    void createComment_unauthenticated_returns401() throws Exception {
        mockMvc.perform(multipart("/api/photos/100/comments")
                        .param("content", "익명 댓글")
                        .contentType(MediaType.MULTIPART_FORM_DATA))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/photos/100/comments with disallowed extension returns 4xx INVALID_FILE_TYPE")
    void createComment_invalidExtension_returns4xx() throws Exception {
        MockMultipartFile bad = new MockMultipartFile(
                "image", "evil.exe", "application/octet-stream", new byte[]{0x4D, 0x5A, 0x00, 0x00}
        );

        mockMvc.perform(multipart("/api/photos/100/comments")
                        .file(bad)
                        .param("content", "이상한 파일")
                        .contentType(MediaType.MULTIPART_FORM_DATA)
                        .cookie(userCookie(1L)))
                .andExpect(status().is4xxClientError())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(40060)));
    }

    @Test
    @DisplayName("POST /api/photos/100/comments with mismatched content-type returns 4xx INVALID_FILE_TYPE")
    void createComment_invalidMime_returns4xx() throws Exception {
        // 확장자는 jpg 지만 Content-Type 은 text/plain.
        MockMultipartFile bad = new MockMultipartFile(
                "image", "fake.jpg", "text/plain", jpegBytes()
        );

        mockMvc.perform(multipart("/api/photos/100/comments")
                        .file(bad)
                        .param("content", "MIME 위조")
                        .contentType(MediaType.MULTIPART_FORM_DATA)
                        .cookie(userCookie(1L)))
                .andExpect(status().is4xxClientError())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(40060)));
    }

    @Test
    @DisplayName("POST /api/photos/100/comments with bad magic byte returns 4xx INVALID_FILE_TYPE")
    void createComment_badMagicByte_returns4xx() throws Exception {
        // 확장자/MIME 은 png 처럼 보이지만 매직바이트는 깨져 있음.
        MockMultipartFile bad = new MockMultipartFile(
                "image", "fake.png", "image/png", new byte[]{0x00, 0x00, 0x00, 0x00, 0x00}
        );

        mockMvc.perform(multipart("/api/photos/100/comments")
                        .file(bad)
                        .param("content", "매직바이트 위조")
                        .contentType(MediaType.MULTIPART_FORM_DATA)
                        .cookie(userCookie(1L)))
                .andExpect(status().is4xxClientError())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(40060)));
    }

    @Test
    @DisplayName("POST /api/photos/100/comments accepts PNG when extension/MIME/magic byte all align")
    void createComment_validPng_returnsImageUrl() throws Exception {
        MockMultipartFile image = new MockMultipartFile(
                "image", "ok.png", "image/png", pngBytes()
        );

        mockMvc.perform(multipart("/api/photos/100/comments")
                        .file(image)
                        .param("content", "PNG 인증샷")
                        .contentType(MediaType.MULTIPART_FORM_DATA)
                        .cookie(userCookie(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.imageUrl", endsWith(".png")));
    }

    @Test
    @DisplayName("GET /api/photos/100/comments returns seeded comments with imageUrl field serialized")
    void listComments_returnsAscendingWithImageUrl() throws Exception {
        mockMvc.perform(get("/api/photos/100/comments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.comments", hasSize(greaterThanOrEqualTo(3))))
                .andExpect(jsonPath("$.results.comments[0].id", lessThan(999)))
                // 시드 댓글은 image 가 없으므로 null 로 직렬화됨.
                .andExpect(jsonPath("$.results.comments[0].imageUrl", is(nullValue())));
    }

    @Test
    @DisplayName("DELETE /api/comments/{id} by the author returns 204")
    void deleteComment_author_returns204() throws Exception {
        mockMvc.perform(delete("/api/comments/5").cookie(userCookie(1L)))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("DELETE /api/comments/{id} by another user returns 403 UNAUTHORIZED_COMMENT")
    void deleteComment_nonAuthor_returns403() throws Exception {
        mockMvc.perform(delete("/api/comments/1").cookie(userCookie(1L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(40370)));
    }
}
