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

    @Test
    @DisplayName("POST /api/photos/100/comments with parentId attaches reply, response carries parentId")
    void createComment_withParentId_returnsParentId() throws Exception {
        // 시드 comment id=1 은 photo 100 의 댓글 (다른 테스트에서 활용 중).
        mockMvc.perform(multipart("/api/photos/100/comments")
                        .param("content", "@parent 동의해요")
                        .param("parentId", "1")
                        .contentType(MediaType.MULTIPART_FORM_DATA)
                        .cookie(userCookie(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.parentId", is(1)))
                .andExpect(jsonPath("$.results.content", is("@parent 동의해요")));
    }

    @Test
    @DisplayName("POST /api/photos/{id}/comments without parentId leaves parentId=null in response")
    void createComment_noParent_parentIdIsNull() throws Exception {
        mockMvc.perform(multipart("/api/photos/100/comments")
                        .param("content", "혼자 다는 댓글")
                        .contentType(MediaType.MULTIPART_FORM_DATA)
                        .cookie(userCookie(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.parentId", is(nullValue())));
    }

    @Test
    @DisplayName("POST /api/photos/100/comments with parentId belonging to a different photo returns 404 COMMENT_NOT_FOUND")
    void createComment_crossPhotoParent_returns404() throws Exception {
        // 시드 comment id=1 은 photo 100 의 댓글. 그걸 photo 110 의 답글로 달려고 시도.
        mockMvc.perform(multipart("/api/photos/110/comments")
                        .param("content", "잘못된 부모")
                        .param("parentId", "1")
                        .contentType(MediaType.MULTIPART_FORM_DATA)
                        .cookie(userCookie(1L)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(40011)));
    }

    @Test
    @DisplayName("POST /api/photos/{id}/comments with non-existent parentId returns 404 COMMENT_NOT_FOUND")
    void createComment_unknownParent_returns404() throws Exception {
        mockMvc.perform(multipart("/api/photos/100/comments")
                        .param("content", "유령 부모")
                        .param("parentId", "9999999")
                        .contentType(MediaType.MULTIPART_FORM_DATA)
                        .cookie(userCookie(1L)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is(40011)));
    }

    @Test
    @DisplayName("POST /api/photos/{id}/comments rejects reply-to-reply (depth > 1) with 400 REQUEST_ERROR")
    void createComment_replyToReply_returns400() throws Exception {
        // 1) parent 댓글 작성
        String parentBody = mockMvc.perform(multipart("/api/photos/100/comments")
                        .param("content", "1차 댓글")
                        .contentType(MediaType.MULTIPART_FORM_DATA)
                        .cookie(userCookie(1L)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        // id 추출 (간단 파싱)
        int idx = parentBody.indexOf("\"id\":") + 5;
        int end = parentBody.indexOf(",", idx);
        long parentId = Long.parseLong(parentBody.substring(idx, end).trim());

        // 2) 그 부모에 답글 작성
        String replyBody = mockMvc.perform(multipart("/api/photos/100/comments")
                        .param("content", "1차 답글")
                        .param("parentId", String.valueOf(parentId))
                        .contentType(MediaType.MULTIPART_FORM_DATA)
                        .cookie(userCookie(1L)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        int idx2 = replyBody.indexOf("\"id\":") + 5;
        int end2 = replyBody.indexOf(",", idx2);
        long replyId = Long.parseLong(replyBody.substring(idx2, end2).trim());

        // 3) 그 답글을 부모로 또 답글 시도 → 거부
        mockMvc.perform(multipart("/api/photos/100/comments")
                        .param("content", "2차 답글 (불가)")
                        .param("parentId", String.valueOf(replyId))
                        .contentType(MediaType.MULTIPART_FORM_DATA)
                        .cookie(userCookie(1L)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is(30001)));
    }

    @Test
    @DisplayName("GET /api/photos/{id}/comments includes replies with their parentId in the same flat list")
    void listComments_includesRepliesWithParentId() throws Exception {
        // 답글 작성 후 GET 응답에 parentId 가 채워진 entry 가 보이는지.
        mockMvc.perform(multipart("/api/photos/100/comments")
                        .param("content", "리스트용 답글")
                        .param("parentId", "1")
                        .contentType(MediaType.MULTIPART_FORM_DATA)
                        .cookie(userCookie(1L)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/photos/100/comments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.comments[?(@.parentId == 1)]", hasSize(greaterThanOrEqualTo(1))));
    }
}
