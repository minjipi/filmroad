package com.filmroad.api.domain.place;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.filmroad.api.domain.auth.JwtTokenService;
import com.filmroad.api.domain.place.dto.PhotoUploadRequest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
    private PlacePhotoImageRepository placePhotoImageRepository;

    @Autowired
    private PlaceRepository placeRepository;

    @Autowired
    private com.filmroad.api.domain.user.UserRepository userRepository;

    @Value("${project.upload.path}")
    private String uploadPath;

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
                "files", "test.jpg", MediaType.IMAGE_JPEG_VALUE, JPEG_BYTES);
    }

    private MockMultipartFile buildImage(String name) {
        return new MockMultipartFile(
                "files", name, MediaType.IMAGE_JPEG_VALUE, JPEG_BYTES);
    }

    @Test
    @DisplayName("POST /api/photos with placeId=10 uploads image and persists PlacePhoto")
    void upload_validRequest_persistsPhoto() throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(10L, null, null, PhotoVisibility.PUBLIC, false, null, null);

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
    @DisplayName("POST /api/photos — imageUrl 은 `/uploads/yyyy/MM/dd/<uuid>.<ext>` 날짜 폴더 경로 (task #43)")
    void upload_storesInDateBucketedPath() throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(10L, null, null, PhotoVisibility.PUBLIC, false, null, null);

        MvcResult result = mockMvc.perform(multipart("/api/photos")
                        .file(buildImage())
                        .file(buildMeta(req))
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                // 형식 검증: /uploads/YYYY/MM/DD/<uuid>.<ext>. regex 는 json-path matcher 로 직접 걸기 어려우므로
                // startsWith + 추가 패턴 분리.
                .andExpect(jsonPath("$.results.imageUrl", startsWith("/uploads/")))
                .andExpect(jsonPath("$.results.imageUrl",
                        matchesPattern("^/uploads/\\d{4}/\\d{2}/\\d{2}/[0-9a-fA-F-]+\\.(jpg|jpeg|png|webp)$")))
                .andReturn();

        // imageUrl 에서 `/uploads/` 접두를 떼서 실제 파일 시스템에도 써졌는지 확인 (날짜 디렉토리 자동 생성 포함).
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        String imageUrl = body.at("/results/imageUrl").asText();
        String relative = imageUrl.substring("/uploads/".length());
        Path written = Paths.get(uploadPath).resolve(relative).normalize();
        assertThat(Files.exists(written))
                .as("파일이 날짜 서브폴더에 실제로 써졌는지")
                .isTrue();
    }

    @Test
    @DisplayName("POST /api/photos with unknown placeId returns PLACE_NOT_FOUND")
    void upload_unknownPlace_returnsNotFound() throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(99999L, null, null, PhotoVisibility.PUBLIC, false, null, null);

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
        PhotoUploadRequest req = new PhotoUploadRequest(10L, null, null, PhotoVisibility.PUBLIC, false, null, null);
        MockMultipartFile badFile = new MockMultipartFile(
                "files", "bad.txt", MediaType.TEXT_PLAIN_VALUE, "hello".getBytes());

        mockMvc.perform(multipart("/api/photos")
                        .file(badFile)
                        .file(buildMeta(req))
                        .cookie(demoAccessCookie()))
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(40060)))
                // 사용자가 다음 행동을 결정할 수 있도록 지원 포맷 안내가 메시지에 포함.
                .andExpect(jsonPath("$.message", containsString("JPG")))
                .andExpect(jsonPath("$.message", containsString("PNG")))
                .andExpect(jsonPath("$.message", containsString("WebP")));
    }

    @Test
    @DisplayName("POST /api/photos — 확장자만 .png 인 HEIC 파일은 매직 바이트에서 차단되고 안내 메시지에 'HEIC' 포함")
    void upload_heicWithPngExtension_returnsHelpfulMessage() throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(10L, null, null, PhotoVisibility.PUBLIC, false, null, null);
        // ftyp box + heic 브랜드 — 실제 iPhone HEIC 파일 시그니처. 확장자만
        // .png 로 위장했지만 magic-byte 단계에서 PNG 시그니처(0x89 'P' 'N' 'G')
        // 와 어긋나 차단되어야.
        byte[] heicBytes = new byte[]{
                0x00, 0x00, 0x00, 0x20, // box length
                'f', 't', 'y', 'p',     // box type
                'h', 'e', 'i', 'c',     // major brand
                0x00, 0x00, 0x00, 0x00,
                'm', 'i', 'f', '1', 'm', 'i', 'a', 'f',
        };
        MockMultipartFile heic = new MockMultipartFile(
                "files", "고양이양말.png", MediaType.IMAGE_PNG_VALUE, heicBytes);

        mockMvc.perform(multipart("/api/photos")
                        .file(heic)
                        .file(buildMeta(req))
                        .cookie(demoAccessCookie()))
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(40060)))
                .andExpect(jsonPath("$.message", containsString("HEIC")));
    }

    @Test
    @DisplayName("POST /api/photos with caption + tags parses tags into list and persists caption")
    void upload_withCaptionAndTags_parsesAndPersists() throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(
                10L, "오늘의 인증샷", "도깨비, 강릉 , 인생샷,,  ", PhotoVisibility.FOLLOWERS, true, null, null);

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
        PhotoUploadRequest req = new PhotoUploadRequest(10L, null, null, PhotoVisibility.PUBLIC, false, null, null);
        MockMultipartFile suspicious = new MockMultipartFile(
                "files", "evil.jsp.jpg", MediaType.TEXT_PLAIN_VALUE, JPEG_BYTES);

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
        PhotoUploadRequest req = new PhotoUploadRequest(10L, null, null, PhotoVisibility.PUBLIC, false, null, null);
        MockMultipartFile fakeImage = new MockMultipartFile(
                "files", "fake.jpg", MediaType.IMAGE_JPEG_VALUE,
                new byte[]{0x00, 0x00, 0x00, 0x00, 0x00, 0x00});

        mockMvc.perform(multipart("/api/photos")
                        .file(fakeImage)
                        .file(buildMeta(req))
                        .cookie(demoAccessCookie()))
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(40060)));
    }

    @Test
    @DisplayName("GET /api/photos/{id} — 공개 PUBLIC 사진: place/work/author/topComments 블록 + viewer-specific liked/saved")
    void getPhoto_publicSeed_returnsDetail() throws Exception {
        // 시드 photo 100 = place 10(주문진 영진해변), work 1(도깨비, tvN), user_id=1, visibility=PUBLIC.
        // user=1 토큰 → isMe=true, photo_like(photo=100)/place_like(place=10)/saved_place(place=10) 전부 시드에 있어 liked=saved=true.
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/photos/100")
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.id", is(100)))
                .andExpect(jsonPath("$.results.imageUrl", notNullValue()))
                .andExpect(jsonPath("$.results.visibility", is("PUBLIC")))
                .andExpect(jsonPath("$.results.liked", is(true)))
                .andExpect(jsonPath("$.results.saved", is(true)))
                .andExpect(jsonPath("$.results.place.id", is(10)))
                .andExpect(jsonPath("$.results.place.name", is("주문진 영진해변 방파제")))
                .andExpect(jsonPath("$.results.work.id", is(1)))
                .andExpect(jsonPath("$.results.work.title", is("도깨비")))
                .andExpect(jsonPath("$.results.work.type", is("DRAMA")))
                .andExpect(jsonPath("$.results.work.network", is("tvN")))
                .andExpect(jsonPath("$.results.author.id", is(1)))
                .andExpect(jsonPath("$.results.author.isMe", is(true)))
                .andExpect(jsonPath("$.results.topComments", notNullValue()))
                .andExpect(jsonPath("$.results.moreCommentsCount", greaterThanOrEqualTo(0)));
    }

    @Test
    @DisplayName("GET /api/photos/{id} — 타 유저 PUBLIC 사진: isMe=false, liked/saved 는 viewer 에 없으면 false")
    void getPhoto_foreignPublic_isMeFalseAndViewerSpecificFlags() throws Exception {
        // photo 101 = place 10, user_id=2 (이서준), visibility=PUBLIC. user=1 토큰으로 조회.
        // user=1 은 photo 101 에 대한 photo_like 없음 → liked=false.
        // place 10 은 user=1 saved_place(place=10) 있음 → saved=true.
        // user=1 은 시드에서 user=2 를 follow 중이므로 author.following=true.
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/photos/101")
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.author.id", is(2)))
                .andExpect(jsonPath("$.results.author.isMe", is(false)))
                .andExpect(jsonPath("$.results.author.following", is(true)))
                .andExpect(jsonPath("$.results.liked", is(false)))
                .andExpect(jsonPath("$.results.saved", is(true)));
    }

    @Test
    @DisplayName("GET /api/photos/{id} — 내 사진 author.following = false (자기 자신은 follow 대상 X)")
    void getPhoto_ownPhoto_authorFollowingIsFalse() throws Exception {
        // photo 100 = user_id=1. user=1 토큰 → isMe=true 이므로 following 은 false.
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/photos/100")
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.author.isMe", is(true)))
                .andExpect(jsonPath("$.results.author.following", is(false)));
    }

    // 비로그인 anonymous 케이스는 따로 검증 안 함 — CurrentUser.currentUserId() 가
    // 데모 폴백(user=1)을 반환해서 실제 anonymous 시나리오와 동일하지 않음. 폴백
    // 제거 작업이 들어오기 전엔 author.following 도 user=1 의 관계로 채워진다.

    @Test
    @DisplayName("GET /api/photos/{id} — 내 PRIVATE 사진은 owner 본인에게 200")
    void getPhoto_ownPrivate_allowedForOwner() throws Exception {
        // 직접 user=1 소유 PRIVATE 사진을 저장.
        com.filmroad.api.domain.user.User u1 = userRepository.findById(1L).orElseThrow();
        Place p = placeRepository.findById(10L).orElseThrow();
        int nextOrder = placePhotoRepository.findMaxOrderIndexByPlaceId(10L) + 1;
        PlacePhoto own = PlacePhoto.builder()
                .place(p).user(u1)
                .orderIndex(nextOrder)
                .visibility(PhotoVisibility.PRIVATE)
                .build();
        own.addImage(PlacePhotoImage.builder()
                .imageUrl("/uploads/own-private.jpg")
                .imageOrderIndex(0)
                .build());
        own = placePhotoRepository.save(own);

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
        PlacePhoto foreign = PlacePhoto.builder()
                .place(p).user(u2)
                .orderIndex(nextOrder)
                .visibility(PhotoVisibility.PRIVATE)
                .build();
        foreign.addImage(PlacePhotoImage.builder()
                .imageUrl("/uploads/u2-private.jpg")
                .imageOrderIndex(0)
                .build());
        foreign = placePhotoRepository.save(foreign);

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
        PhotoUploadRequest req = new PhotoUploadRequest(10L, "회귀 테스트", null, PhotoVisibility.PUBLIC, false, null, null);

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
    @DisplayName("POST /api/photos — gpsScore 가 임계 이상이면 stamp + reward (pointsEarned=50) 발급")
    void upload_returnsStampAndReward() throws Exception {
        // 시드 place 10 의 좌표(37.8928, 128.8347) 와 동일하게 보내 gpsScore=100 → 인증 통과.
        mockMvc.perform(multipart("/api/photos")
                        .file(buildImage())
                        .file(buildMetaWithCoords(10L, 37.8928, 128.8347))
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.stamp.workTitle", is("도깨비")))
                .andExpect(jsonPath("$.results.stamp.totalCount", greaterThan(0)))
                .andExpect(jsonPath("$.results.reward.pointsEarned", is(50)))
                .andExpect(jsonPath("$.results.reward.levelName", notNullValue()))
                .andExpect(jsonPath("$.results.reward.newBadges", notNullValue()));
    }

    // ---- task #45a · 멀티 파일 업로드 + 1:N images ----

    @Test
    @DisplayName("POST /api/photos — 3장 업로드: PlacePhoto 1 row + place_photo_image 3 row, imageOrderIndex ASC")
    void upload_storesMultipleFilesAsOnePostWithThreeImages() throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(10L, "세 장짜리 배치", null, PhotoVisibility.PUBLIC, false, null, null);

        long postCountBefore = placePhotoRepository.count();
        long imageCountBefore = placePhotoImageRepository.count();

        MvcResult result = mockMvc.perform(multipart("/api/photos")
                        .file(buildImage("a.jpg"))
                        .file(buildImage("b.jpg"))
                        .file(buildImage("c.jpg"))
                        .file(buildMeta(req))
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.images", hasSize(3)))
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        long postId = body.at("/results/id").asLong();
        java.util.List<Integer> orderIndexes = new java.util.ArrayList<>();
        body.at("/results/images").forEach(n -> orderIndexes.add(n.get("imageOrderIndex").asInt()));
        // 0,1,2 순서로 ASC.
        assertThat(orderIndexes).containsExactly(0, 1, 2);

        // 3장 = post 1 + image 3 (정확히 차이만큼 row 증가).
        assertThat(placePhotoRepository.count() - postCountBefore).isEqualTo(1);
        assertThat(placePhotoImageRepository.count() - imageCountBefore).isEqualTo(3);

        // 동일 post 의 images 가 N=3 인지 직접 확인.
        PlacePhoto post = placePhotoRepository.findById(postId).orElseThrow();
        assertThat(post.getImages()).hasSize(3);
    }

    @Test
    @DisplayName("POST /api/photos — 6장 초과 → 400 INVALID_FILE_TYPE")
    void upload_rejectsWhenOverFiveFiles() throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(10L, null, null, PhotoVisibility.PUBLIC, false, null, null);
        var builder = multipart("/api/photos")
                .file(buildImage("1.jpg"))
                .file(buildImage("2.jpg"))
                .file(buildImage("3.jpg"))
                .file(buildImage("4.jpg"))
                .file(buildImage("5.jpg"))
                .file(buildImage("6.jpg"))
                .file(buildMeta(req))
                .cookie(demoAccessCookie());

        mockMvc.perform(builder)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is(40060)));
    }

    @Test
    @DisplayName("POST /api/photos — 2장 정상 + 1장 magic-byte 위조 → 400, post / image 어느 쪽도 새로 저장되지 않음")
    void upload_rollsBackAllOnMagicByteFailure() throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(10L, null, null, PhotoVisibility.PUBLIC, false, null, null);
        MockMultipartFile fake = new MockMultipartFile(
                "files", "fake.jpg", MediaType.IMAGE_JPEG_VALUE,
                new byte[]{0x00, 0x00, 0x00, 0x00, 0x00, 0x00});

        long postsBefore = placePhotoRepository.count();
        long imagesBefore = placePhotoImageRepository.count();

        mockMvc.perform(multipart("/api/photos")
                        .file(buildImage("ok1.jpg"))
                        .file(buildImage("ok2.jpg"))
                        .file(fake)
                        .file(buildMeta(req))
                        .cookie(demoAccessCookie()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is(40060)));

        // 선검증에서 거부 → post / image 어느 쪽도 새 row 없어야 한다.
        assertThat(placePhotoRepository.count())
                .as("배치 실패 시 PlacePhoto 도 부분 저장 금지").isEqualTo(postsBefore);
        assertThat(placePhotoImageRepository.count())
                .as("배치 실패 시 PlacePhotoImage 도 부분 저장 금지").isEqualTo(imagesBefore);
    }

    @Test
    @DisplayName("POST /api/photos — 3장 업로드해도 points 는 한 batch 당 +50 한 번만 (인증 통과 좌표)")
    void upload_grantsRewardOnlyOnceForBatch() throws Exception {
        com.filmroad.api.domain.user.User before = userRepository.findById(1L).orElseThrow();
        int pointsBefore = before.getPoints();

        // place 10 좌표 → gpsScore=100 → 인증 통과. 멀티 업로드 보상 정책 검증의 의미가 살아남.
        mockMvc.perform(multipart("/api/photos")
                        .file(buildImage("a.jpg"))
                        .file(buildImage("b.jpg"))
                        .file(buildImage("c.jpg"))
                        .file(buildMetaWithCoords(10L, 37.8928, 128.8347))
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.reward.pointsEarned", is(50)));

        com.filmroad.api.domain.user.User after = userRepository.findById(1L).orElseThrow();
        assertThat(after.getPoints())
                .as("멀티 업로드에서도 points 는 +50 한 번만")
                .isEqualTo(pointsBefore + 50);
    }

    @Test
    @DisplayName("GET /api/photos/{id} — 3장 업로드된 post 의 상세: images imageOrderIndex ASC")
    void getPhotoDetail_returnsImagesAscending() throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(10L, "batch", null, PhotoVisibility.PUBLIC, false, null, null);
        MvcResult uploaded = mockMvc.perform(multipart("/api/photos")
                        .file(buildImage("x1.jpg"))
                        .file(buildImage("x2.jpg"))
                        .file(buildImage("x3.jpg"))
                        .file(buildMeta(req))
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andReturn();

        long postId = objectMapper.readTree(uploaded.getResponse().getContentAsString())
                .at("/results/id").asLong();

        MvcResult detail = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/photos/" + postId)
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.images", hasSize(3)))
                .andReturn();

        JsonNode imgs = objectMapper.readTree(detail.getResponse().getContentAsString())
                .at("/results/images");
        // imageOrderIndex 가 0, 1, 2 ASC.
        assertThat(imgs.get(0).get("imageOrderIndex").asInt()).isEqualTo(0);
        assertThat(imgs.get(1).get("imageOrderIndex").asInt()).isEqualTo(1);
        assertThat(imgs.get(2).get("imageOrderIndex").asInt()).isEqualTo(2);
    }

    // ---- task #6 · 인증샷 채점 (ShotScoringService 통합) ----

    /** 좌표를 포함한 meta 빌더 — 점수 통합 테스트 전용. */
    private MockMultipartFile buildMetaWithCoords(Long placeId, Double lat, Double lng) throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(
                placeId, null, null, PhotoVisibility.PUBLIC, false, lat, lng);
        return new MockMultipartFile(
                "meta", "meta.json", MediaType.APPLICATION_JSON_VALUE,
                objectMapper.writeValueAsBytes(req));
    }

    @Test
    @DisplayName("C1: 좌표 포함 업로드 → 응답에 totalScore/similarityScore/gpsScore 평탄 노출 + 동일 좌표면 gpsScore=100")
    void upload_withCoords_returnsScoresFlat() throws Exception {
        // 시드 place 10 좌표(37.8928, 128.8347) 와 동일 → gpsScore=100 보장.
        // similarity 는 외부 sceneImageUrl(Unsplash) 다운로드 결과에 의존하므로 범위만 검증 (네트워크 실패 시 0).
        mockMvc.perform(multipart("/api/photos")
                        .file(buildImage())
                        .file(buildMetaWithCoords(10L, 37.8928, 128.8347))
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.totalScore", greaterThanOrEqualTo(0)))
                .andExpect(jsonPath("$.results.totalScore", lessThanOrEqualTo(100)))
                .andExpect(jsonPath("$.results.gpsScore", is(100)))
                .andExpect(jsonPath("$.results.similarityScore", greaterThanOrEqualTo(0)))
                .andExpect(jsonPath("$.results.similarityScore", lessThanOrEqualTo(100)))
                .andExpect(jsonPath("$.results.capturedLatitude", is(37.8928)))
                .andExpect(jsonPath("$.results.capturedLongitude", is(128.8347)));
    }

    @Test
    @DisplayName("C2: 좌표 누락(null/null) → 사진은 업로드되지만 gpsScore=0 → stamp/reward 미발급")
    void upload_withoutCoords_gpsZeroAndNoReward() throws Exception {
        // 좌표 없는 업로드는 gpsScore 0 → 인증 임계 미달 → 보상 통째로 스킵.
        // 부정 사용자가 "GPS 안 보내고 보상은 챙긴다" 우회를 막는 핵심 가드.
        com.filmroad.api.domain.user.User before = userRepository.findById(1L).orElseThrow();
        int pointsBefore = before.getPoints();

        mockMvc.perform(multipart("/api/photos")
                        .file(buildImage())
                        .file(buildMetaWithCoords(10L, null, null))
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.gpsScore", is(0)))
                .andExpect(jsonPath("$.results.capturedLatitude").doesNotExist())
                .andExpect(jsonPath("$.results.capturedLongitude").doesNotExist())
                // stamp / reward 응답이 통째로 null — FE 가 "보상 없는 업로드" 분기 탐.
                .andExpect(jsonPath("$.results.stamp").doesNotExist())
                .andExpect(jsonPath("$.results.reward").doesNotExist());

        // 사용자 points 도 그대로.
        com.filmroad.api.domain.user.User after = userRepository.findById(1L).orElseThrow();
        assertThat(after.getPoints())
                .as("GPS 미통과 업로드는 points 누적도 안 됨")
                .isEqualTo(pointsBefore);
    }

    @Test
    @DisplayName("POST /api/photos — 임계 밖(다른 도시) 좌표면 stamp/reward 미발급")
    void upload_farFromPlace_skipsStampAndReward() throws Exception {
        // place 10 = (37.8928, 128.8347). 0.1° 차이는 약 11km — 1km cutoff 도 한참 밖이라 gpsScore=0.
        mockMvc.perform(multipart("/api/photos")
                        .file(buildImage())
                        .file(buildMetaWithCoords(10L, 37.9928, 128.8347))
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.gpsScore", lessThan(50)))
                .andExpect(jsonPath("$.results.stamp").doesNotExist())
                .andExpect(jsonPath("$.results.reward").doesNotExist());
    }

    @Test
    @DisplayName("C3: DB row 에 capturedLatitude/Longitude/totalScore/gpsScore 컬럼이 채워짐 (회귀 방지)")
    void upload_persistsCapturedCoordsAndScores() throws Exception {
        MvcResult result = mockMvc.perform(multipart("/api/photos")
                        .file(buildImage())
                        .file(buildMetaWithCoords(10L, 37.8928, 128.8347))
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andReturn();
        long photoId = objectMapper.readTree(result.getResponse().getContentAsString())
                .at("/results/id").asLong();
        PlacePhoto saved = placePhotoRepository.findById(photoId).orElseThrow();
        assertThat(saved.getCapturedLatitude())
                .as("동일 좌표 업로드 → DB 에 그대로 저장")
                .isEqualTo(37.8928);
        assertThat(saved.getCapturedLongitude()).isEqualTo(128.8347);
        assertThat(saved.getTotalScore()).isBetween(0, 100);
        assertThat(saved.getGpsScore())
                .as("동일 좌표 → gpsScore=100")
                .isEqualTo(100);
        assertThat(saved.getSimilarityScore()).isBetween(0, 100);
    }

    @Test
    @DisplayName("C5 (정책 b): 잘못된 위도(200.0) → 200 OK + gpsScore=0 + 좌표 null 정규화")
    void upload_invalidLatitude_normalizesToNullAndZeroGpsScore() throws Exception {
        // @DecimalMin/@DecimalMax 가 #2 commit 에서 제거됨 → 서비스 단(sanitizeLatitude/Longitude)
        // 에서 lat>90 을 invalid 로 보고 둘 다 null 정규화.
        MvcResult result = mockMvc.perform(multipart("/api/photos")
                        .file(buildImage())
                        .file(buildMetaWithCoords(10L, 200.0, 127.0))
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.gpsScore", is(0)))
                .andExpect(jsonPath("$.results.capturedLatitude").doesNotExist())
                .andExpect(jsonPath("$.results.capturedLongitude").doesNotExist())
                .andReturn();
        long photoId = objectMapper.readTree(result.getResponse().getContentAsString())
                .at("/results/id").asLong();
        PlacePhoto saved = placePhotoRepository.findById(photoId).orElseThrow();
        assertThat(saved.getCapturedLatitude())
                .as("범위 밖 위도 → DB 에도 null 정규화 저장")
                .isNull();
        assertThat(saved.getCapturedLongitude()).isNull();
    }

    @Test
    @DisplayName("C6 (정책 b): 한쪽만 정상(lat=37.5, lng=null) → 둘 다 null 정규화 + gpsScore=0")
    void upload_partialCoords_normalizesBothToNull() throws Exception {
        mockMvc.perform(multipart("/api/photos")
                        .file(buildImage())
                        .file(buildMetaWithCoords(10L, 37.5, null))
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.gpsScore", is(0)))
                .andExpect(jsonPath("$.results.capturedLatitude").doesNotExist())
                .andExpect(jsonPath("$.results.capturedLongitude").doesNotExist());
    }

    /**
     * 작성자가 갓 업로드한 인증샷의 id 를 뽑아주는 헬퍼. PATCH/DELETE 테스트가
     * 매번 같은 ownership 전제로 시작하도록 새 사진을 만들어준다.
     */
    private long uploadOwnPhoto() throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(
                10L, "before edit", null, PhotoVisibility.PUBLIC, false, null, null);
        MvcResult res = mockMvc.perform(multipart("/api/photos")
                        .file(buildImage())
                        .file(buildMeta(req))
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode root = objectMapper.readTree(res.getResponse().getContentAsString());
        return root.path("results").path("id").asLong();
    }

    @Test
    @DisplayName("PATCH /api/photos/{id} as owner — caption + visibility 갱신, 응답에 새 값 노출")
    void patch_asOwner_updatesCaptionAndVisibility() throws Exception {
        long photoId = uploadOwnPhoto();
        String body = """
                { "caption": "after edit", "visibility": "PRIVATE" }
                """;

        mockMvc.perform(patch("/api/photos/" + photoId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.caption", is("after edit")))
                .andExpect(jsonPath("$.results.visibility", is("PRIVATE")));
    }

    @Test
    @DisplayName("PATCH /api/photos/{id} 다른 유저 토큰 → PHOTO_UNAUTHORIZED(40071)")
    void patch_asNonOwner_returnsUnauthorized() throws Exception {
        long photoId = uploadOwnPhoto();
        Cookie otherUser = new Cookie("ATOKEN", jwtTokenService.issueAccess(2L));

        mockMvc.perform(patch("/api/photos/" + photoId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"caption\": \"x\", \"visibility\": \"PUBLIC\" }")
                        .cookie(otherUser))
                .andExpect(status().is4xxClientError())
                .andExpect(jsonPath("$.code", is(40071)));
    }

    @Test
    @DisplayName("DELETE /api/photos/{id} as owner — 사진 + 자식 행 정리, 이후 GET 은 404")
    void delete_asOwner_removesPhotoAndChildren() throws Exception {
        long photoId = uploadOwnPhoto();
        assertThat(placePhotoRepository.findById(photoId)).isPresent();

        mockMvc.perform(delete("/api/photos/" + photoId)
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));

        assertThat(placePhotoRepository.findById(photoId)).isEmpty();
    }

    @Test
    @DisplayName("DELETE /api/photos/{id} 다른 유저 토큰 → PHOTO_UNAUTHORIZED, 사진 그대로")
    void delete_asNonOwner_returnsUnauthorized() throws Exception {
        long photoId = uploadOwnPhoto();
        Cookie otherUser = new Cookie("ATOKEN", jwtTokenService.issueAccess(2L));

        mockMvc.perform(delete("/api/photos/" + photoId)
                        .cookie(otherUser))
                .andExpect(status().is4xxClientError())
                .andExpect(jsonPath("$.code", is(40071)));

        assertThat(placePhotoRepository.findById(photoId)).isPresent();
    }

    @Test
    @DisplayName("C7 (회귀): 멀티 업로드(3장) 에서도 점수는 batch 대표(첫 파일 + 좌표) 기준 1세트")
    void upload_multipleFiles_scoreUsesFirstAsBatchRepresentative() throws Exception {
        PhotoUploadRequest req = new PhotoUploadRequest(
                10L, "batch with coords", null, PhotoVisibility.PUBLIC, false, 37.8928, 128.8347);
        MockMultipartFile meta = new MockMultipartFile(
                "meta", "meta.json", MediaType.APPLICATION_JSON_VALUE,
                objectMapper.writeValueAsBytes(req));

        mockMvc.perform(multipart("/api/photos")
                        .file(buildImage("a.jpg"))
                        .file(buildImage("b.jpg"))
                        .file(buildImage("c.jpg"))
                        .file(meta)
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.images", hasSize(3)))
                // 점수는 batch 대표(첫 파일) 기준 1세트 — 응답 평탄 필드 1개만.
                .andExpect(jsonPath("$.results.gpsScore", is(100)))
                .andExpect(jsonPath("$.results.totalScore", greaterThanOrEqualTo(0)));
    }
}
