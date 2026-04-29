package com.filmroad.api.domain.place;

import com.filmroad.api.domain.place.dto.ShotScoreDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.net.URLConnection;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;

/**
 * 인증샷 채점 — (1) Haversine GPS 거리 → gpsScore, (2) pHash 유사도 → similarityScore,
 * (3) 가중합 → totalScore. PhotoUploadService 가 업로드 시 첫 번째 파일을 대표로 호출.
 *
 * <h3>알고리즘</h3>
 * <ul>
 *   <li><b>GPS</b>: Place 등록 좌표 ↔ 촬영 좌표 거리. 0m=100, 50m=80, 200m=50, 1km+=0 의
 *       구간별 선형 보간. 좌표 누락/범위 밖이면 0 점.</li>
 *   <li><b>유사도</b>: pHash — 32x32 grayscale → 2D DCT-II → 8x8 top-left 블록 → median 비트
 *       해시(64비트). Hamming distance 0=100, 32 이상=0 의 선형 환산. 외부 라이브러리 없음.</li>
 *   <li><b>총점</b>: round(similarity * 0.6 + gps * 0.4). similarity 가 본질적 인증 신호 → 가중치 ↑.</li>
 * </ul>
 *
 * <h3>실패 정책</h3>
 * <p>scene 이미지 URL 누락/다운로드 실패/디코딩 실패 → similarity=0. 좌표 누락 → gps=0.
 * 어떤 경우에도 예외를 throw 하지 않고 0 점으로 fallback — 채점은 부가 기능이며 업로드 자체를
 * 막으면 안 됨.</p>
 */
@Slf4j
@Service
public class ShotScoringService {

    /** pHash DCT 입력 크기. 32 가 표준. */
    private static final int DCT_SIZE = 32;
    /** 유사도 점수 0 으로 떨어지는 Hamming distance 임계 (총 64비트 중). */
    private static final int HAMMING_ZERO_THRESHOLD = 32;

    /** GPS 거리 → 점수 환산 구간 경계. */
    private static final double GPS_PERFECT_M = 0.0;
    private static final double GPS_NEAR_M = 50.0;
    private static final double GPS_MID_M = 200.0;
    private static final double GPS_FAR_M = 1000.0;

    /** 가중치 — 합 1.0. similarity 가 본질적 신호. */
    private static final double SIMILARITY_WEIGHT = 0.6;
    private static final double GPS_WEIGHT = 0.4;

    /** Haversine 지구 반지름 (m). */
    private static final long EARTH_RADIUS_M = 6_371_000L;

    /** 외부 scene URL 다운로드 timeout. 외부 호출이 길어져 업로드 응답을 막지 않도록 짧게. */
    private static final int CONNECT_TIMEOUT_MS = 3_000;
    private static final int READ_TIMEOUT_MS = 5_000;

    /** 로컬 `/uploads/...` scene URL 을 디스크 경로로 매핑할 base. */
    private final String uploadBase;

    public ShotScoringService(@Value("${project.upload.path:./uploads}") String uploadBase) {
        this.uploadBase = uploadBase;
    }

    /**
     * 채점 진입점. uploadedFile 은 batch 의 대표(보통 0번) 한 장만 사용 — 5장 업로드해도
     * 점수는 batch 단위 1세트.
     *
     * @param place         성지 (등록 GPS / sceneImages). null 이면 전 점수 0.
     * @param uploadedFile  업로드 파일. null 이면 similarity 0.
     * @param capturedLat   촬영 위도. null/범위 밖이면 gps 0.
     * @param capturedLng   촬영 경도. null/범위 밖이면 gps 0.
     */
    public ShotScoreDto score(Place place, MultipartFile uploadedFile, Double capturedLat, Double capturedLng) {
        if (place == null) return ShotScoreDto.zero();
        int gps = computeGpsScore(place, capturedLat, capturedLng);
        int sim = computeSimilarityScore(place, uploadedFile);
        int total = clamp((int) Math.round(sim * SIMILARITY_WEIGHT + gps * GPS_WEIGHT), 0, 100);
        return new ShotScoreDto(sim, gps, total);
    }

    // -----------------------------------------------------------------
    // GPS
    // -----------------------------------------------------------------

    int computeGpsScore(Place place, Double lat, Double lng) {
        if (lat == null || lng == null) return 0;
        if (lat < -90.0 || lat > 90.0 || lng < -180.0 || lng > 180.0) return 0;
        double distanceM = haversineMeters(place.getLatitude(), place.getLongitude(), lat, lng);
        if (distanceM <= GPS_PERFECT_M) return 100;
        if (distanceM <= GPS_NEAR_M) {
            // 0~50m: 100 → 80 (-20점/구간)
            return clamp((int) Math.round(100 - (distanceM - GPS_PERFECT_M) / (GPS_NEAR_M - GPS_PERFECT_M) * 20.0), 0, 100);
        }
        if (distanceM <= GPS_MID_M) {
            // 50~200m: 80 → 50 (-30점/구간)
            return clamp((int) Math.round(80 - (distanceM - GPS_NEAR_M) / (GPS_MID_M - GPS_NEAR_M) * 30.0), 0, 100);
        }
        if (distanceM <= GPS_FAR_M) {
            // 200~1000m: 50 → 0 (-50점/구간)
            return clamp((int) Math.round(50 - (distanceM - GPS_MID_M) / (GPS_FAR_M - GPS_MID_M) * 50.0), 0, 100);
        }
        return 0;
    }

    /** Haversine 공식 — 두 좌표 사이 대원거리(meter). */
    static double haversineMeters(double lat1, double lng1, double lat2, double lng2) {
        double phi1 = Math.toRadians(lat1);
        double phi2 = Math.toRadians(lat2);
        double dPhi = Math.toRadians(lat2 - lat1);
        double dLambda = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2)
                + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_M * c;
    }

    // -----------------------------------------------------------------
    // Similarity (pHash)
    // -----------------------------------------------------------------

    int computeSimilarityScore(Place place, MultipartFile uploadedFile) {
        if (uploadedFile == null) return 0;
        // 1:N 씬 모델 — 같은 place 의 모든 씬 후보 중 최대 유사도를 채택. 유저가 어떤 씬을
        // 재현했는지 알 수 없으므로 가장 잘 맞는 1장 기준으로 점수.
        if (place.getSceneImages() == null || place.getSceneImages().isEmpty()) return 0;

        BufferedImage uploaded = loadFromMultipart(uploadedFile);
        if (uploaded == null) return 0;
        long uploadedHash = pHash(uploaded);

        int best = 0;
        for (PlaceSceneImage scene : place.getSceneImages()) {
            String sceneUrl = scene.getImageUrl();
            if (sceneUrl == null || sceneUrl.isBlank()) continue;
            BufferedImage sceneImg = loadSceneImage(sceneUrl);
            if (sceneImg == null) continue;
            long sceneHash = pHash(sceneImg);
            int hamming = Long.bitCount(sceneHash ^ uploadedHash);
            // 0 → 100, HAMMING_ZERO_THRESHOLD(32) → 0. 그 이상은 0.
            double ratio = Math.max(0.0, 1.0 - (hamming / (double) HAMMING_ZERO_THRESHOLD));
            int score = clamp((int) Math.round(ratio * 100), 0, 100);
            if (score > best) best = score;
        }
        return best;
    }

    /**
     * scene 이미지 로드. `/uploads/...` 로컬 경로 / `http(s)://...` 외부 URL 둘 다 지원.
     * traversal 방지를 위해 정규화 후 base 안에 머무는지 확인.
     */
    BufferedImage loadSceneImage(String url) {
        try {
            if (url.startsWith("/uploads/")) {
                Path uploadDir = Paths.get(uploadBase).toAbsolutePath().normalize();
                Path target = uploadDir.resolve(url.substring("/uploads/".length())).normalize();
                if (!target.startsWith(uploadDir) || !Files.exists(target)) return null;
                try (InputStream in = Files.newInputStream(target)) {
                    return ImageIO.read(in);
                }
            }
            if (url.startsWith("http://") || url.startsWith("https://")) {
                URL u = new URL(url);
                URLConnection conn = u.openConnection();
                conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
                conn.setReadTimeout(READ_TIMEOUT_MS);
                try (InputStream in = conn.getInputStream()) {
                    return ImageIO.read(in);
                }
            }
            return null;
        } catch (IOException e) {
            log.debug("[SCORE] scene image load failed url={} : {}", url, e.toString());
            return null;
        }
    }

    BufferedImage loadFromMultipart(MultipartFile file) {
        try (InputStream in = file.getInputStream()) {
            return ImageIO.read(in);
        } catch (IOException e) {
            log.debug("[SCORE] uploaded image load failed: {}", e.toString());
            return null;
        }
    }

    // -----------------------------------------------------------------
    // pHash 알고리즘 — 32x32 grayscale → 2D DCT → 8x8 top-left → median 비트 해시
    // -----------------------------------------------------------------

    long pHash(BufferedImage src) {
        double[][] pixels = grayResize(src, DCT_SIZE);
        double[][] dct = applyDct2(pixels);
        // 8x8 top-left = 64 계수.
        double[] sample = new double[64];
        int idx = 0;
        for (int y = 0; y < 8; y++) {
            for (int x = 0; x < 8; x++) {
                sample[idx++] = dct[y][x];
            }
        }
        // DC(0,0) 은 평균값이라 hash 안정성을 위해 median 계산 시 제외.
        double[] forMedian = Arrays.copyOfRange(sample, 1, sample.length);
        Arrays.sort(forMedian);
        double median = forMedian[forMedian.length / 2];
        long hash = 0L;
        for (int i = 0; i < 64; i++) {
            if (sample[i] > median) hash |= (1L << i);
        }
        return hash;
    }

    /** 입력 이미지를 size×size grayscale 로 리사이즈하여 double 행렬로 추출. */
    static double[][] grayResize(BufferedImage src, int size) {
        BufferedImage resized = new BufferedImage(size, size, BufferedImage.TYPE_BYTE_GRAY);
        Graphics2D g = resized.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.drawImage(src, 0, 0, size, size, null);
        g.dispose();
        double[][] out = new double[size][size];
        for (int y = 0; y < size; y++) {
            for (int x = 0; x < size; x++) {
                out[y][x] = resized.getRaster().getSample(x, y, 0);
            }
        }
        return out;
    }

    /**
     * 2D DCT-II — N×N 입력에 대해 N^4 ops. N=32 면 ~1M ops 로 즉시 완료.
     * cosine 테이블을 미리 계산해 캐싱.
     */
    static double[][] applyDct2(double[][] m) {
        int N = m.length;
        double[][] cos = new double[N][N];
        for (int i = 0; i < N; i++) {
            for (int k = 0; k < N; k++) {
                cos[i][k] = Math.cos((2 * i + 1) * k * Math.PI / (2.0 * N));
            }
        }
        double[][] out = new double[N][N];
        double scale = 2.0 / N;
        double sqrtHalf = 1.0 / Math.sqrt(2);
        for (int u = 0; u < N; u++) {
            for (int v = 0; v < N; v++) {
                double sum = 0.0;
                for (int i = 0; i < N; i++) {
                    double cosIu = cos[i][u];
                    for (int j = 0; j < N; j++) {
                        sum += m[i][j] * cosIu * cos[j][v];
                    }
                }
                double cu = u == 0 ? sqrtHalf : 1.0;
                double cv = v == 0 ? sqrtHalf : 1.0;
                out[u][v] = cu * cv * sum * scale;
            }
        }
        return out;
    }

    static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
