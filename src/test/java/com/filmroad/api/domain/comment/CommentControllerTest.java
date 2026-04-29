package com.filmroad.api.domain.comment;

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

    @Autowired
    private PlacePhotoRepository placePhotoRepository;

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
    @DisplayName("DELETE 부모 댓글: 자식 답글들도 함께 삭제 + commentCount 가 부모+자식 수만큼 차감")
    void deleteComment_parent_cascadesToReplies() throws Exception {
        // 1) photo 100 의 baseline commentCount 확인
        long before = mockMvc.perform(get("/api/photos/100"))
                .andReturn().getResponse().getContentAsString()
                .lines()
                .findFirst()
                .map(s -> {
                    int idx = s.indexOf("\"commentCount\":");
                    if (idx < 0) return 0L;
                    int start = idx + "\"commentCount\":".length();
                    int end = s.indexOf(",", start);
                    if (end < 0) end = s.indexOf("}", start);
                    return Long.parseLong(s.substring(start, end).trim());
                })
                .orElse(0L);

        // 2) 부모 댓글 작성 (user 1 소유)
        String parentBody = mockMvc.perform(multipart("/api/photos/100/comments")
                        .param("content", "삭제 테스트용 부모")
                        .contentType(MediaType.MULTIPART_FORM_DATA)
                        .cookie(userCookie(1L)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        int idx = parentBody.indexOf("\"id\":") + 5;
        int end = parentBody.indexOf(",", idx);
        long parentId = Long.parseLong(parentBody.substring(idx, end).trim());

        // 3) 그 부모에 답글 2개 (user 1 이 둘 다 작성, 권한 단순화)
        for (int i = 0; i < 2; i++) {
            mockMvc.perform(multipart("/api/photos/100/comments")
                            .param("content", "답글 " + i)
                            .param("parentId", String.valueOf(parentId))
                            .contentType(MediaType.MULTIPART_FORM_DATA)
                            .cookie(userCookie(1L)))
                    .andExpect(status().isOk());
        }

        // 4) 이 시점 commentCount = before + 3 (부모 1 + 답글 2)
        mockMvc.perform(get("/api/photos/100"))
                .andExpect(jsonPath("$.results.commentCount", is((int) before + 3)));

        // 5) 부모 삭제
        mockMvc.perform(delete("/api/comments/" + parentId).cookie(userCookie(1L)))
                .andExpect(status().isNoContent());

        // 6) commentCount 가 baseline 으로 복귀 — cascade 가 자식 답글까지 같이 처리.
        mockMvc.perform(get("/api/photos/100"))
                .andExpect(jsonPath("$.results.commentCount", is((int) before)));

        // 7) 자식 답글 페이지엔 자식이 더 이상 보이지 않음 — parentId == parentId 인 항목 0개.
        mockMvc.perform(get("/api/photos/100/comments"))
                .andExpect(jsonPath(
                        "$.results.comments[?(@.parentId == " + parentId + ")]", hasSize(0)));
    }

    @Test
    @DisplayName("DELETE 답글(자식): 다른 답글이나 부모는 그대로 — 자기 자신만 삭제")
    void deleteComment_reply_doesNotAffectSiblings() throws Exception {
        // 부모 작성
        String parentBody = mockMvc.perform(multipart("/api/photos/100/comments")
                        .param("content", "부모")
                        .contentType(MediaType.MULTIPART_FORM_DATA)
                        .cookie(userCookie(1L)))
                .andReturn().getResponse().getContentAsString();
        long parentId = Long.parseLong(parentBody.substring(parentBody.indexOf("\"id\":") + 5,
                parentBody.indexOf(",", parentBody.indexOf("\"id\":") + 5)).trim());

        // 답글 2개
        long[] replyIds = new long[2];
        for (int i = 0; i < 2; i++) {
            String body = mockMvc.perform(multipart("/api/photos/100/comments")
                            .param("content", "답글 " + i)
                            .param("parentId", String.valueOf(parentId))
                            .contentType(MediaType.MULTIPART_FORM_DATA)
                            .cookie(userCookie(1L)))
                    .andReturn().getResponse().getContentAsString();
            replyIds[i] = Long.parseLong(body.substring(body.indexOf("\"id\":") + 5,
                    body.indexOf(",", body.indexOf("\"id\":") + 5)).trim());
        }

        // 첫 답글만 삭제
        mockMvc.perform(delete("/api/comments/" + replyIds[0]).cookie(userCookie(1L)))
                .andExpect(status().isNoContent());

        // 부모 + 두번째 답글은 살아있음
        mockMvc.perform(get("/api/photos/100/comments"))
                .andExpect(jsonPath("$.results.comments[?(@.id == " + parentId + ")]", hasSize(1)))
                .andExpect(jsonPath("$.results.comments[?(@.id == " + replyIds[1] + ")]", hasSize(1)))
                .andExpect(jsonPath("$.results.comments[?(@.id == " + replyIds[0] + ")]", hasSize(0)));
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

    @Test
    @DisplayName("POST /api/photos/{id}/comments — 비작성자가 PRIVATE 사진에 직접 호출 → PHOTO_NOT_FOUND")
    void createComment_privatePhoto_byNonOwner_returnsNotFound() throws Exception {
        // photo 100 은 user 1 소유 시드. PRIVATE 으로 바꾼 뒤 user 2 로 댓글 시도.
        PlacePhoto photo = placePhotoRepository.findById(100L).orElseThrow();
        photo.updateContent(photo.getCaption(), PhotoVisibility.PRIVATE);
        placePhotoRepository.save(photo);

        mockMvc.perform(multipart("/api/photos/100/comments")
                        .param("content", "비공개 사진에 댓글 시도")
                        .contentType(MediaType.MULTIPART_FORM_DATA)
                        .cookie(userCookie(2L)))
                .andExpect(status().is4xxClientError())
                .andExpect(jsonPath("$.code", is(40070)));
    }

    @Test
    @DisplayName("GET /api/photos/{id}/comments — 비작성자가 PRIVATE 사진 댓글 목록 조회 → PHOTO_NOT_FOUND")
    void listComments_privatePhoto_byNonOwner_returnsNotFound() throws Exception {
        PlacePhoto photo = placePhotoRepository.findById(100L).orElseThrow();
        photo.updateContent(photo.getCaption(), PhotoVisibility.PRIVATE);
        placePhotoRepository.save(photo);

        mockMvc.perform(get("/api/photos/100/comments")
                        .cookie(userCookie(2L)))
                .andExpect(status().is4xxClientError())
                .andExpect(jsonPath("$.code", is(40070)));
    }

    @Test
    @DisplayName("GET /api/photos/{id}/comments — 작성자 본인은 PRIVATE 사진의 댓글 목록 조회 가능")
    void listComments_privatePhoto_byOwner_succeeds() throws Exception {
        PlacePhoto photo = placePhotoRepository.findById(100L).orElseThrow();
        photo.updateContent(photo.getCaption(), PhotoVisibility.PRIVATE);
        placePhotoRepository.save(photo);

        mockMvc.perform(get("/api/photos/100/comments")
                        .cookie(userCookie(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));
    }
}
