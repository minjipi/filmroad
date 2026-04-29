package com.filmroad.api.domain.place;

import com.filmroad.api.domain.place.dto.ShotScoreDto;
import com.filmroad.api.domain.work.Work;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link ShotScoringService}.
 *
 * 외부 의존성 없이 ShotScoringService 를 직접 인스턴스화 (`@Value` 의존 하나뿐).
 * 같은 패키지에 두어 package-private 헬퍼(`computeGpsScore`, `computeSimilarityScore`,
 * `loadSceneImage`, `pHash` 등) 도 직접 호출.
 *
 * <h3>테스트 분할</h3>
 * <ul>
 *   <li>{@link GpsScore} — Haversine + 구간별 선형 보간 검증</li>
 *   <li>{@link SimilarityScore} — pHash 동일/노이즈/이미지 부재/디코딩 실패 fallback</li>
 *   <li>{@link TotalScore} — 진입점 score(...) 의 가중합·실패 정책 통합 검증</li>
 * </ul>
 */
class ShotScoringServiceTest {

    @TempDir
    Path uploadDir;

    private ShotScoringService service;

    /** GPS 케이스용 베이스 좌표 — 시드 place 10(주문진 영진해변)과 동일. */
    private static final double PLACE_LAT = 37.8928;
    private static final double PLACE_LNG = 128.8347;

    @BeforeEach
    void setUp() {
        service = new ShotScoringService(uploadDir.toString());
    }

    @AfterEach
    void cleanUp() throws IOException {
        if (Files.exists(uploadDir)) {
            try (Stream<Path> walk = Files.walk(uploadDir)) {
                walk.sorted(Comparator.reverseOrder())
                        .map(Path::toFile)
                        .forEach(java.io.File::delete);
            }
        }
    }

    // -----------------------------------------------------------------
    // helpers — 더미 이미지 byte[] / Place 빌더 / scene 파일 setup
    // -----------------------------------------------------------------

    /** 단색 PNG 정사각형 byte[]. */
    private static byte[] solidImage(Color color, int size) throws IOException {
        BufferedImage img = new BufferedImage(size, size, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        try {
            g.setColor(color);
            g.fillRect(0, 0, size, size);
        } finally {
            g.dispose();
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    /** 8x8 체커보드 PNG byte[]. pHash 가 단색과 잘 구별하도록 명확한 패턴. */
    private static byte[] checkerImage(int size) throws IOException {
        BufferedImage img = new BufferedImage(size, size, BufferedImage.TYPE_INT_RGB);
        int cell = Math.max(1, size / 8);
        for (int y = 0; y < size; y++) {
            for (int x = 0; x < size; x++) {
                boolean black = ((x / cell) + (y / cell)) % 2 == 0;
                img.setRGB(x, y, black ? 0x000000 : 0xFFFFFF);
            }
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    /**
     * Place mock — Work 만 minimal stub, 좌표/sceneUrl 만 의미 있음.
     * sceneUrl == null 이면 sceneImages 컬렉션을 비워두고(=등록된 씬 없음 시나리오),
     * non-null 이면 imageOrderIndex=0 행을 한 장 부착해 primary 로 노출.
     */
    private static Place place(double lat, double lng, String sceneUrl) {
        Place p = Place.builder()
                .name("test")
                .regionLabel("test")
                .latitude(lat)
                .longitude(lng)
                .work(Work.builder().title("t").build())
                .build();
        if (sceneUrl != null) {
            p.addSceneImage(PlaceSceneImage.builder()
                    .imageUrl(sceneUrl)
                    .imageOrderIndex(0)
                    .build());
        }
        return p;
    }

    /** scene 이미지를 uploadDir/<name> 에 써두고 그 경로를 `/uploads/<name>` 로 반환. */
    private String writeSceneFile(String name, byte[] bytes) throws IOException {
        Path target = uploadDir.resolve(name);
        Files.createDirectories(target.getParent() == null ? uploadDir : target.getParent());
        Files.write(target, bytes);
        return "/uploads/" + name;
    }

    private static MockMultipartFile multipart(String name, byte[] bytes) {
        return new MockMultipartFile("files", name, "image/png", bytes);
    }

    // -----------------------------------------------------------------
    // A-1 GPS 점수
    // -----------------------------------------------------------------

    @Nested
    @DisplayName("GPS 점수 (Haversine + 구간별 선형 보간)")
    class GpsScore {

        @Test
        @DisplayName("G1: 동일 좌표 → 100점")
        void identicalCoordinates_returns100() {
            int score = service.computeGpsScore(place(PLACE_LAT, PLACE_LNG, null), PLACE_LAT, PLACE_LNG);
            assertThat(score).isEqualTo(100);
        }

        @Test
        @DisplayName("G2: 약 50m 거리 → 80점 ±2 (구간 0~50m: 100→80 선형)")
        void around50m_returnsAbout80() {
            // 위도 0.00045도 ≈ 50m
            int score = service.computeGpsScore(
                    place(PLACE_LAT, PLACE_LNG, null),
                    PLACE_LAT + 0.00045, PLACE_LNG);
            assertThat(score).isBetween(78, 82);
        }

        @Test
        @DisplayName("G3: 약 200m 거리 → 50점 ±3 (구간 50~200m: 80→50 선형)")
        void around200m_returnsAbout50() {
            // 위도 0.0018도 ≈ 200m
            int score = service.computeGpsScore(
                    place(PLACE_LAT, PLACE_LNG, null),
                    PLACE_LAT + 0.0018, PLACE_LNG);
            assertThat(score).isBetween(47, 53);
        }

        @Test
        @DisplayName("G4: 약 1km 거리 → 0~5점 (구간 200~1000m 끝점)")
        void around1km_returnsNearZero() {
            // 위도 0.009도 ≈ 1.0km
            int score = service.computeGpsScore(
                    place(PLACE_LAT, PLACE_LNG, null),
                    PLACE_LAT + 0.009, PLACE_LNG);
            assertThat(score).isBetween(0, 5);
        }

        @Test
        @DisplayName("G5: 1km 초과 → 0점")
        void over1km_returnsZero() {
            int score = service.computeGpsScore(
                    place(PLACE_LAT, PLACE_LNG, null),
                    PLACE_LAT + 0.05, PLACE_LNG);  // ~5.5km
            assertThat(score).isEqualTo(0);
        }

        @Test
        @DisplayName("G6: 촬영 좌표 null → 0점")
        void capturedNull_returnsZero() {
            assertThat(service.computeGpsScore(place(PLACE_LAT, PLACE_LNG, null), null, null)).isEqualTo(0);
            assertThat(service.computeGpsScore(place(PLACE_LAT, PLACE_LNG, null), 37.5, null)).isEqualTo(0);
            assertThat(service.computeGpsScore(place(PLACE_LAT, PLACE_LNG, null), null, 127.0)).isEqualTo(0);
        }

        @Test
        @DisplayName("G7: 촬영 좌표 범위 밖(lat=91, lng=181) → 0점")
        void capturedOutOfRange_returnsZero() {
            assertThat(service.computeGpsScore(place(PLACE_LAT, PLACE_LNG, null), 91.0, PLACE_LNG)).isEqualTo(0);
            assertThat(service.computeGpsScore(place(PLACE_LAT, PLACE_LNG, null), PLACE_LAT, 181.0)).isEqualTo(0);
            assertThat(service.computeGpsScore(place(PLACE_LAT, PLACE_LNG, null), -91.0, PLACE_LNG)).isEqualTo(0);
        }

        @Test
        @DisplayName("G8: Null Island(0,0) — place 한국 좌표면 1km 훨씬 초과 → 0점")
        void nullIsland_returnsZero() {
            assertThat(service.computeGpsScore(place(PLACE_LAT, PLACE_LNG, null), 0.0, 0.0)).isEqualTo(0);
        }

        @Test
        @DisplayName("Haversine sanity: 위도 1도 ≈ 111km, 경도 1도(서울 위도) ≈ 88km")
        void haversineSanity() {
            // 위도 1도 차이 — 약 111km
            double d1 = ShotScoringService.haversineMeters(37.0, 127.0, 38.0, 127.0);
            assertThat(d1).isBetween(110_000.0, 112_000.0);
            // 서울 위도(37.5)에서 경도 1도 — cos(37.5°) * 111km ≈ 88km
            double d2 = ShotScoringService.haversineMeters(37.5, 127.0, 37.5, 128.0);
            assertThat(d2).isBetween(87_000.0, 89_000.0);
        }
    }

    // -----------------------------------------------------------------
    // A-2 유사도 점수 (pHash)
    // -----------------------------------------------------------------

    @Nested
    @DisplayName("유사도 점수 (pHash, 외부 의존 0)")
    class SimilarityScore {

        @Test
        @DisplayName("S1: 동일 이미지 (scene = uploaded) → 95점 이상")
        void identicalImage_returnsHighScore() throws IOException {
            byte[] bytes = checkerImage(64);
            String sceneUrl = writeSceneFile("identical.png", bytes);
            int score = service.computeSimilarityScore(
                    place(PLACE_LAT, PLACE_LNG, sceneUrl),
                    multipart("upload.png", bytes));
            assertThat(score).isGreaterThanOrEqualTo(95);
        }

        @Test
        @DisplayName("S2: 체커보드 vs 단색 → 명확히 다름. score < 동일 케이스")
        void checkerVsSolid_returnsLowerScoreThanIdentical() throws IOException {
            byte[] checker = checkerImage(64);
            byte[] white = solidImage(Color.WHITE, 64);

            String checkerUrl = writeSceneFile("checker.png", checker);
            int identicalScore = service.computeSimilarityScore(
                    place(PLACE_LAT, PLACE_LNG, checkerUrl),
                    multipart("upload.png", checker));
            int differentScore = service.computeSimilarityScore(
                    place(PLACE_LAT, PLACE_LNG, checkerUrl),
                    multipart("upload.png", white));

            // 동일 이미지보다 명확히 낮음 — 알고리즘 변별력 검증.
            assertThat(differentScore).isLessThan(identicalScore);
            assertThat(differentScore).isLessThan(70);
        }

        @Test
        @DisplayName("S3: sceneImageUrl null → 0점")
        void sceneUrlNull_returnsZero() throws IOException {
            int score = service.computeSimilarityScore(
                    place(PLACE_LAT, PLACE_LNG, null),
                    multipart("u.png", checkerImage(64)));
            assertThat(score).isEqualTo(0);
        }

        @Test
        @DisplayName("S4: sceneImageUrl 빈 문자열 → 0점")
        void sceneUrlBlank_returnsZero() throws IOException {
            int score = service.computeSimilarityScore(
                    place(PLACE_LAT, PLACE_LNG, ""),
                    multipart("u.png", checkerImage(64)));
            assertThat(score).isEqualTo(0);
        }

        @Test
        @DisplayName("S5: scene 파일 부재 (loadSceneImage 실패) → 0점, 예외 X")
        void sceneFileMissing_returnsZero() throws IOException {
            // /uploads/ghost.png 파일 안 만들고 URL 만 주입
            int score = service.computeSimilarityScore(
                    place(PLACE_LAT, PLACE_LNG, "/uploads/ghost.png"),
                    multipart("u.png", checkerImage(64)));
            assertThat(score).isEqualTo(0);
        }

        @Test
        @DisplayName("S6: 업로드 파일이 비-이미지 바이트 → 0점, 예외 X")
        void uploadedNotImage_returnsZero() throws IOException {
            String sceneUrl = writeSceneFile("scene.png", checkerImage(64));
            byte[] textBytes = "this is not an image".getBytes(StandardCharsets.UTF_8);
            int score = service.computeSimilarityScore(
                    place(PLACE_LAT, PLACE_LNG, sceneUrl),
                    multipart("text.png", textBytes));
            assertThat(score).isEqualTo(0);
        }

        @Test
        @DisplayName("S7: scene URL 이 알 수 없는 prefix (file://, ftp://) → 0점")
        void sceneUrlUnknownScheme_returnsZero() throws IOException {
            int score = service.computeSimilarityScore(
                    place(PLACE_LAT, PLACE_LNG, "file:///etc/passwd"),
                    multipart("u.png", checkerImage(64)));
            assertThat(score).isEqualTo(0);
        }

        @Test
        @DisplayName("S8: path traversal (`/uploads/../etc/passwd`) → 0점 (base 밖 차단)")
        void pathTraversal_blocked() throws IOException {
            int score = service.computeSimilarityScore(
                    place(PLACE_LAT, PLACE_LNG, "/uploads/../etc/passwd"),
                    multipart("u.png", checkerImage(64)));
            assertThat(score).isEqualTo(0);
        }
    }

    // -----------------------------------------------------------------
    // A-3 총점 — 진입점 score(...) 가중합 + 실패 fallback
    // -----------------------------------------------------------------

    @Nested
    @DisplayName("총점 (score 진입점) — gps*0.4 + sim*0.6, clamp [0,100]")
    class TotalScore {

        @Test
        @DisplayName("T1: 동일 좌표 + 동일 이미지 → 100 (가중치 1.0 합)")
        void perfectMatch_returns100() throws IOException {
            byte[] bytes = checkerImage(64);
            String sceneUrl = writeSceneFile("scene.png", bytes);
            ShotScoreDto result = service.score(
                    place(PLACE_LAT, PLACE_LNG, sceneUrl),
                    multipart("u.png", bytes),
                    PLACE_LAT, PLACE_LNG);
            assertThat(result.gpsScore()).isEqualTo(100);
            assertThat(result.similarityScore()).isGreaterThanOrEqualTo(95);
            // sim=95~100 + gps=100 → round(95*0.6 + 100*0.4) = 97~100
            assertThat(result.totalScore()).isBetween(97, 100);
        }

        @Test
        @DisplayName("T2: 좌표 누락 + 동일 이미지 → gps=0, sim≥95, total=round(sim*0.6) ≥ 57")
        void noCoords_simHigh_totalReflectsSimWeight() throws IOException {
            byte[] bytes = checkerImage(64);
            String sceneUrl = writeSceneFile("scene.png", bytes);
            ShotScoreDto result = service.score(
                    place(PLACE_LAT, PLACE_LNG, sceneUrl),
                    multipart("u.png", bytes),
                    null, null);
            assertThat(result.gpsScore()).isEqualTo(0);
            assertThat(result.similarityScore()).isGreaterThanOrEqualTo(95);
            // sim=95~100, gps=0 → round(sim*0.6) = 57~60
            assertThat(result.totalScore()).isBetween(57, 60);
        }

        @Test
        @DisplayName("T3: 동일 좌표 + sceneUrl null → sim=0, gps=100, total=round(100*0.4)=40")
        void coordsExact_simZero_totalReflectsGpsWeight() throws IOException {
            ShotScoreDto result = service.score(
                    place(PLACE_LAT, PLACE_LNG, null),
                    multipart("u.png", checkerImage(64)),
                    PLACE_LAT, PLACE_LNG);
            assertThat(result.gpsScore()).isEqualTo(100);
            assertThat(result.similarityScore()).isEqualTo(0);
            assertThat(result.totalScore()).isEqualTo(40);
        }

        @Test
        @DisplayName("T4: 좌표 누락 + sceneUrl null → 모두 0")
        void allMissing_returnsZero() throws IOException {
            ShotScoreDto result = service.score(
                    place(PLACE_LAT, PLACE_LNG, null),
                    multipart("u.png", checkerImage(64)),
                    null, null);
            assertThat(result.gpsScore()).isEqualTo(0);
            assertThat(result.similarityScore()).isEqualTo(0);
            assertThat(result.totalScore()).isEqualTo(0);
        }

        @Test
        @DisplayName("T5: place=null → 모두 0 (fallback)")
        void placeNull_returnsZero() throws IOException {
            ShotScoreDto result = service.score(
                    null,
                    multipart("u.png", checkerImage(64)),
                    PLACE_LAT, PLACE_LNG);
            assertThat(result.totalScore()).isEqualTo(0);
            assertThat(result.gpsScore()).isEqualTo(0);
            assertThat(result.similarityScore()).isEqualTo(0);
        }

        @Test
        @DisplayName("T6: 0~100 clamp 보장 — 어떤 입력 조합이어도 ShotScoreDto 의 모든 점수는 [0,100]")
        void allScoresAlwaysInRange() throws IOException {
            byte[] bytes = checkerImage(64);
            String sceneUrl = writeSceneFile("scene.png", bytes);
            ShotScoreDto perfect = service.score(
                    place(PLACE_LAT, PLACE_LNG, sceneUrl),
                    multipart("u.png", bytes),
                    PLACE_LAT, PLACE_LNG);
            assertThat(perfect.totalScore()).isBetween(0, 100);
            assertThat(perfect.gpsScore()).isBetween(0, 100);
            assertThat(perfect.similarityScore()).isBetween(0, 100);

            ShotScoreDto far = service.score(
                    place(PLACE_LAT, PLACE_LNG, null),
                    multipart("u.png", new byte[]{0x00, 0x00, 0x00}),
                    null, null);
            assertThat(far.totalScore()).isBetween(0, 100);
        }
    }
}
