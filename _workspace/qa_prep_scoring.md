# QA Prep — 인증샷 점수 기능 (Task #6, #7)

승인된 설계 초안을 기반으로, 의존 task 완료 후 즉시 붙여넣을 수 있는 fixture/스켈레톤 코드를 미리 모아둔다.

> **상태**: backend-dev #1 (completed) / #2 (pending) / frontend-dev #3 (completed) / #5 (pending).
> #1/#3 산출물 확정 → 셀렉터/시그니처/응답 shape 픽스 완료. 가중치(#2)와 점수 컴포넌트(#5)는 placeholder 유지.

## 0. 확정된 사실 (#1, #3 + team-lead forward)

### Backend #1 (commit 직후 상태)
- `PhotoUploadRequest` 7-arg 생성자: `(Long placeId, String caption, String tags, PhotoVisibility visibility, boolean addToStampbook, Double latitude, Double longitude)`
- `PhotoUploadResponse`: **flat** — `totalScore, similarityScore, gpsScore, capturedLatitude, capturedLongitude` 가 results 직속 (**Q3 답**)
- `PlacePhoto`: `applyScores(int similarity, int gps, int total)` / `setCapturedCoordinates(Double lat, Double lng)` 도메인 메서드 + 모든 필드 `@Getter` 자동 노출
- 모든 점수 컬럼은 `int` (Integer 아님), default 0 (NOT NULL)

### Backend #2 정책 변경 (team-lead forward, 2차 갱신)

> ⚠ **좌표 검증 정책이 (a)→(b)로 뒤집혔음. 1차 forward 무효화.**

- **Q1 가중치 확정**: `totalScore = round(gpsScore * 0.4 + similarityScore * 0.6)`, clamp [0,100]
- **Q2 좌표 정책 (b)**: `@DecimalMin/@DecimalMax` 어노테이션은 **#2 commit에서 제거됨**.
  - 잘못된 좌표(lat>90, lng>180, NaN, 한쪽만 null 등) → 서비스 단에서 **둘 다 null 정규화** → `gpsScore=0`, 업로드는 **200 OK**
  - DB row 의 `captured_latitude/longitude` 도 둘 다 null 로 저장
- **응답 구조**: team-lead 메시지에서 "results[i]" 표현 — 멀티이미지 업로드 시 점수 노출 위치 확인 필요. `PhotoUploadResponse.java` 본 결과 `totalScore`는 post 단위 단일 필드, `images: List<PhotoImageSummary>`는 첨부 이미지 배열. **#2 commit 후 실제 응답 shape 재검증 필수** (점수가 image별로 나뉘었는지 vs post 단위인지).

### Frontend #3
- 가이드 썸네일 컨테이너: `.guide-thumb` — **`v-if="overlaySrc && mode === 'plain'"`** (compare/overlay 모드에선 미렌더)
- 토글 버튼: `.guide-thumb__toggle`, `data-testid="camera-guide-thumb-toggle"`, `aria-label` 동적 변경, `aria-pressed=guideThumbVisible`
- 썸네일 이미지: `.guide-thumb__img`, `v-if="guideThumbVisible"`
- 상태 변수: `guideThumbVisible: Ref<boolean>` 기본 true, `onToggleGuideThumb()` 가 토글
- iOS safe-area 처리됨: `top: calc(72px + env(safe-area-inset-top))` (**회귀 #8 자동 PASS**)

### Frontend #3
- 가이드 썸네일 컨테이너: `.guide-thumb` — **`v-if="overlaySrc && mode === 'plain'"`** (compare/overlay 모드에선 미렌더)
- 토글 버튼: `.guide-thumb__toggle`, `data-testid="camera-guide-thumb-toggle"`, `aria-label` 동적 변경, `aria-pressed=guideThumbVisible`
- 썸네일 이미지: `.guide-thumb__img`, `v-if="guideThumbVisible"`
- 상태 변수: `guideThumbVisible: Ref<boolean>` 기본 true, `onToggleGuideThumb()` 가 토글
- iOS safe-area 처리됨: `top: calc(72px + env(safe-area-inset-top))` (**회귀 #8 자동 PASS**)

---

## 1. 백엔드 — `ShotScoringServiceTest` 사전 준비

### 1.1 더미 이미지 byte[] 생성 헬퍼 (pHash 단위 테스트용)

`src/test/java/com/filmroad/api/domain/place/ShotScoringServiceTest.java` 에 inline 또는 별도 utility:

```java
import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

/**
 * 단색 정사각형 PNG byte[] 를 만든다. pHash 비교 케이스에 사용.
 * - solidImage(WHITE, 64) ↔ solidImage(BLACK, 64) → 완전 다른 이미지 (S2)
 * - solidImage(WHITE, 64) ↔ solidImage(WHITE, 64) → 완전 동일 (S1)
 */
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

/**
 * 같은 이미지에 한 픽셀만 다른 색으로 바꾼 변형 — S3 노이즈 회귀.
 * 8x8 다운샘플 후에도 pHash 가 거의 동일해야 한다.
 */
private static byte[] solidWithOnePixel(Color base, Color pixel, int size) throws IOException {
    BufferedImage img = new BufferedImage(size, size, BufferedImage.TYPE_INT_RGB);
    Graphics2D g = img.createGraphics();
    try {
        g.setColor(base);
        g.fillRect(0, 0, size, size);
    } finally {
        g.dispose();
    }
    img.setRGB(size / 2, size / 2, pixel.getRGB());
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    ImageIO.write(img, "png", out);
    return out.toByteArray();
}

/** S6: 비-이미지 바이트 (텍스트). ImageIO.read → null 또는 IOException. */
private static byte[] textBytes() {
    return "this is not an image".getBytes(java.nio.charset.StandardCharsets.UTF_8);
}
```

### 1.2 ShotScoringService 단위 테스트 스켈레톤

> ⚠ **실제 의존성/메서드 시그니처는 backend-dev가 ShotScoringService 구현 후 확정.** 아래는 예상 시그니처 기준 placeholder.

```java
package com.filmroad.api.domain.place;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShotScoringServiceTest {

    // 의존: 가이드 이미지 fetch 추상화 (URL → byte[]). backend-dev가 어떤 이름으로 만들지에 맞춰 수정.
    @Mock
    private GuideImageLoader guideImageLoader;  // 가칭

    @InjectMocks
    private ShotScoringService scoring;

    // ---- A-1 GPS 점수 ----
    @Nested
    @DisplayName("GPS 점수 (Haversine)")
    class GpsScore {

        @Test
        @DisplayName("G1: 동일 좌표 → 100점")
        void identicalCoords() {
            int score = scoring.calcGpsScore(37.5, 127.0, 37.5, 127.0);
            assertThat(score).isEqualTo(100);
        }

        @Test
        @DisplayName("G2: 약 55m 거리 → 80점 이상")
        void within50m() {
            // 위도 1도 ≈ 111km → 0.0005도 ≈ 55.5m
            int score = scoring.calcGpsScore(37.5, 127.0, 37.5005, 127.0);
            assertThat(score).isGreaterThanOrEqualTo(80);
        }

        @Test
        @DisplayName("G3: 약 200m 거리 → 40~60점")
        void around200m() {
            int score = scoring.calcGpsScore(37.5, 127.0, 37.5018, 127.0);
            assertThat(score).isBetween(40, 60);
        }

        @Test
        @DisplayName("G4: 1km 이상 → 0점")
        void over1km() {
            int score = scoring.calcGpsScore(37.5, 127.0, 37.51, 127.0);
            assertThat(score).isEqualTo(0);
        }

        @Test
        @DisplayName("G5: 촬영 좌표 null → 0점")
        void capturedNull() {
            int score = scoring.calcGpsScore(37.5, 127.0, null, null);
            assertThat(score).isEqualTo(0);
        }

        @Test
        @DisplayName("G6: place 좌표 null → 0점, 예외 X")
        void placeNullDefensive() {
            int score = scoring.calcGpsScore(null, null, 37.5, 127.0);
            assertThat(score).isEqualTo(0);
        }

        @Test
        @DisplayName("G7: Null Island (0,0) → 정상 거리 계산 → 0점 (1km 초과)")
        void nullIsland() {
            int score = scoring.calcGpsScore(37.5, 127.0, 0.0, 0.0);
            assertThat(score).isEqualTo(0);
        }
    }

    // ---- A-2 유사도 점수 ----
    @Nested
    @DisplayName("유사도 점수 (pHash)")
    class SimilarityScore {

        @Test
        @DisplayName("S1: 완전 동일 이미지 → 95점 이상")
        void identicalImage() throws Exception {
            byte[] white = solidImage(Color.WHITE, 64);
            when(guideImageLoader.load(any())).thenReturn(white);
            int score = scoring.calcSimilarity("https://guide/white.png", white);
            assertThat(score).isGreaterThanOrEqualTo(95);
        }

        @Test
        @DisplayName("S2: 흰색 vs 검은색 → 30점 미만")
        void completelyDifferent() throws Exception {
            byte[] white = solidImage(Color.WHITE, 64);
            byte[] black = solidImage(Color.BLACK, 64);
            when(guideImageLoader.load(any())).thenReturn(white);
            int score = scoring.calcSimilarity("https://guide/white.png", black);
            assertThat(score).isLessThan(30);
        }

        @Test
        @DisplayName("S3: 1픽셀 노이즈 → 90점 이상 (회귀)")
        void minorNoise() throws Exception {
            byte[] base = solidImage(Color.WHITE, 64);
            byte[] noisy = solidWithOnePixel(Color.WHITE, Color.GRAY, 64);
            when(guideImageLoader.load(any())).thenReturn(base);
            int score = scoring.calcSimilarity("https://guide/white.png", noisy);
            assertThat(score).isGreaterThanOrEqualTo(90);
        }

        @Test
        @DisplayName("S4: sceneImageUrl null → 0점")
        void guideUrlNull() {
            int score = scoring.calcSimilarity(null, solidImage(Color.WHITE, 64));
            assertThat(score).isEqualTo(0);
        }

        @Test
        @DisplayName("S5: 가이드 fetch 실패 → 0점, 예외 전파 X")
        void guideLoadFails() {
            when(guideImageLoader.load(any())).thenThrow(new RuntimeException("404"));
            int score = scoring.calcSimilarity("https://guide/missing.png", solidImage(Color.WHITE, 64));
            assertThat(score).isEqualTo(0);
        }

        @Test
        @DisplayName("S6: 가이드는 정상이지만 업로드가 비-이미지 바이트 → 0점")
        void uploadedBytesNotImage() {
            byte[] white = solidImage(Color.WHITE, 64);
            when(guideImageLoader.load(any())).thenReturn(white);
            int score = scoring.calcSimilarity("https://guide/white.png", textBytes());
            assertThat(score).isEqualTo(0);
        }
    }

    // ---- A-3 총점 가중 합산 (가중치 확정: gps*0.4 + sim*0.6) ----
    @Nested
    @DisplayName("총점 — totalScore = round(gps * 0.4 + sim * 0.6), clamp [0,100]")
    class TotalScore {

        @Test
        @DisplayName("T1: gps=100, sim=100 → 100")
        void allMax() {
            assertThat(scoring.calcTotal(100, 100)).isEqualTo(100);
        }

        @Test
        @DisplayName("T2: gps=0, sim=100 → 60 (sim 가중치 0.6)")
        void gpsZero() {
            assertThat(scoring.calcTotal(0, 100)).isEqualTo(60);
        }

        @Test
        @DisplayName("T3: gps=100, sim=0 → 40 (gps 가중치 0.4)")
        void simZero() {
            assertThat(scoring.calcTotal(100, 0)).isEqualTo(40);
        }

        @Test
        @DisplayName("T4: gps=0, sim=0 → 0")
        void allZero() {
            assertThat(scoring.calcTotal(0, 0)).isEqualTo(0);
        }

        @Test
        @DisplayName("T5: round 검증 — gps=50, sim=75 → round(20+45)=65")
        void roundsCorrectly() {
            assertThat(scoring.calcTotal(50, 75)).isEqualTo(65);
        }

        @Test
        @DisplayName("T6: 음수/100초과 입력 → 0~100 clamp")
        void clampOutOfRange() {
            assertThat(scoring.calcTotal(-10, 50)).isBetween(0, 100);
            assertThat(scoring.calcTotal(150, 50)).isBetween(0, 100);
        }
    }
}
```

### 1.3 PhotoControllerTest — 좌표 멀티파트 빌더 헬퍼 (확정 시그니처)

기존 `buildMeta(PhotoUploadRequest)` 패턴 그대로 확장. `PhotoUploadRequest`의 7-arg 생성자 사용:

```java
// 기존 PhotoControllerTest 안에 추가
private MockMultipartFile buildMetaWithCoords(Long placeId, Double lat, Double lng) throws Exception {
    PhotoUploadRequest req = new PhotoUploadRequest(
        placeId, null, null, PhotoVisibility.PUBLIC, false, lat, lng);
    return new MockMultipartFile(
        "meta", "meta.json", MediaType.APPLICATION_JSON_VALUE,
        objectMapper.writeValueAsBytes(req));
}

@Test
@DisplayName("C1: 좌표 포함 업로드 → 응답에 totalScore/similarityScore/gpsScore 모두 노출")
void upload_withCoords_returnsScores() throws Exception {
    // place 10 시드 좌표(37.8927, 128.8350)와 동일 → GPS 만점 유도
    mockMvc.perform(multipart("/api/photos")
                    .file(buildImage())
                    .file(buildMetaWithCoords(10L, 37.8927, 128.8350))
                    .cookie(demoAccessCookie()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.results.totalScore", greaterThanOrEqualTo(0)))
            .andExpect(jsonPath("$.results.totalScore", lessThanOrEqualTo(100)))
            .andExpect(jsonPath("$.results.gpsScore", is(100)))      // 동일 좌표
            .andExpect(jsonPath("$.results.similarityScore", greaterThanOrEqualTo(0)))
            .andExpect(jsonPath("$.results.capturedLatitude", is(37.8927)))
            .andExpect(jsonPath("$.results.capturedLongitude", is(128.8350)));
}

@Test
@DisplayName("C2: 좌표 누락(null) → gpsScore=0, 업로드/리워드 정상")
void upload_withoutCoords_gpsZeroButUploadOk() throws Exception {
    mockMvc.perform(multipart("/api/photos")
                    .file(buildImage())
                    .file(buildMetaWithCoords(10L, null, null))
                    .cookie(demoAccessCookie()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.results.gpsScore", is(0)))
            .andExpect(jsonPath("$.results.capturedLatitude").doesNotExist())
            .andExpect(jsonPath("$.results.reward.pointsEarned", is(50)));
}

@Test
@DisplayName("C3: DB row 에 capturedLatitude/Longitude/score 컬럼이 채워짐")
void upload_persistsCapturedCoordsAndScore() throws Exception {
    MvcResult result = mockMvc.perform(multipart("/api/photos")
                    .file(buildImage())
                    .file(buildMetaWithCoords(10L, 37.8927, 128.8350))
                    .cookie(demoAccessCookie()))
            .andExpect(status().isOk())
            .andReturn();
    long photoId = objectMapper.readTree(result.getResponse().getContentAsString())
            .at("/results/id").asLong();
    PlacePhoto saved = placePhotoRepository.findById(photoId).orElseThrow();
    assertThat(saved.getCapturedLatitude()).isEqualTo(37.8927);
    assertThat(saved.getCapturedLongitude()).isEqualTo(128.8350);
    assertThat(saved.getTotalScore()).isBetween(0, 100);
    assertThat(saved.getGpsScore()).isEqualTo(100);
}

@Test
@DisplayName("C5 (정책 b): 잘못된 위도(200.0) → 200 + gpsScore=0 + 좌표 null 정규화")
void upload_invalidLatitude_normalizesAndZeroesGpsScore() throws Exception {
    // @DecimalMin/Max 가 #2 commit 에서 제거됨 → 서비스 단에서 lat>90 을 invalid 로 보고 둘 다 null 정규화
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
    assertThat(saved.getCapturedLatitude()).isNull();
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

@Test
@DisplayName("C7 (정책 b): NaN 좌표 → 둘 다 null 정규화 + gpsScore=0 (예외 X)")
void upload_nanCoords_normalizesAndUploadsOk() throws Exception {
    mockMvc.perform(multipart("/api/photos")
                    .file(buildImage())
                    .file(buildMetaWithCoords(10L, Double.NaN, Double.NaN))
                    .cookie(demoAccessCookie()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.results.gpsScore", is(0)));
}
```

> ✅ **확정**: 응답은 flat — `$.results.totalScore` 등 직속 필드. nested 아님.
>
> ⚠ **재검증 필요(backend-dev #2 commit 후)**: team-lead forward 에서 "results[i].totalScore" 표현이 있었음. 멀티이미지 업로드 시 점수가 image 별로 노출되는 변경이 있었는지 확인 필요. 현재 `PhotoUploadResponse.java` 기준으로는 `totalScore`가 post 단위 단일 필드.

---

## 2. 프론트엔드 — Task #7 사전 준비

### 2.1 CameraPage 가이드 토글 spec 스켈레톤 (확정 셀렉터)

> ⚠ **사전조건**: `.guide-thumb` 는 `mode === 'plain'` 일 때만 렌더 — 모든 토글 spec 은 먼저 "일반" 모드로 전환해야 함.

기존 `frontend/src/views/__tests__/CameraPage.spec.ts` 에 describe 블록 추가:

```ts
describe('CameraPage 우상단 가이드 썸네일 토글 (task #3)', () => {
  /** plain 모드로 전환하는 헬퍼 — guide-thumb 가 v-if 로 조건부 렌더되므로 필수. */
  async function switchToPlain(wrapper: ReturnType<typeof mountCamera>['wrapper']) {
    const modes = wrapper.findAll('.mode');
    // 0:비교, 1:오버레이, 2:일반
    await modes[2].trigger('click');
    await flushPromises();
  }

  it('F1: plain 모드 + targetPlace 있음 → guide-thumb 렌더, 기본 visible=true', async () => {
    const { wrapper } = mountCamera();
    await flushPromises();
    await switchToPlain(wrapper);
    expect(wrapper.find('.guide-thumb').exists()).toBe(true);
    expect(wrapper.find('.guide-thumb__img').exists()).toBe(true);
    const toggle = wrapper.find('[data-testid="camera-guide-thumb-toggle"]');
    expect(toggle.exists()).toBe(true);
    expect(toggle.attributes('aria-pressed')).toBe('true');
  });

  it('F2: 토글 버튼 클릭 → 썸네일 이미지 숨김 (컨테이너는 유지, aria-pressed=false)', async () => {
    const { wrapper } = mountCamera();
    await flushPromises();
    await switchToPlain(wrapper);
    const toggle = wrapper.find('[data-testid="camera-guide-thumb-toggle"]');
    await toggle.trigger('click');
    // .guide-thumb__img 는 v-if=guideThumbVisible 이므로 사라짐
    expect(wrapper.find('.guide-thumb__img').exists()).toBe(false);
    expect(toggle.attributes('aria-pressed')).toBe('false');
  });

  it('F3: 토글 버튼 한 번 더 클릭 → 다시 보임', async () => {
    const { wrapper } = mountCamera();
    await flushPromises();
    await switchToPlain(wrapper);
    const toggle = wrapper.find('[data-testid="camera-guide-thumb-toggle"]');
    await toggle.trigger('click');  // hide
    await toggle.trigger('click');  // show
    expect(wrapper.find('.guide-thumb__img').exists()).toBe(true);
    expect(toggle.attributes('aria-pressed')).toBe('true');
  });

  it('F4: targetPlace=null → 어떤 모드에서도 guide-thumb 미렌더', async () => {
    const { wrapper } = mountCamera({ ...baseUploadState, targetPlace: null });
    await flushPromises();
    await switchToPlain(wrapper);
    // overlaySrc 가 null 이라 guide-thumb 컨테이너 자체가 v-if=false
    expect(wrapper.find('.guide-thumb').exists()).toBe(false);
    expect(wrapper.find('[data-testid="camera-guide-thumb-toggle"]').exists()).toBe(false);
  });

  it('F5: 토글 버튼 aria-label 이 상태에 따라 변경 (접근성)', async () => {
    const { wrapper } = mountCamera();
    await flushPromises();
    await switchToPlain(wrapper);
    const toggle = wrapper.find('[data-testid="camera-guide-thumb-toggle"]');
    expect(toggle.attributes('aria-label')).toBe('가이드 사진 숨기기');
    await toggle.trigger('click');
    expect(toggle.attributes('aria-label')).toBe('가이드 사진 보기');
  });

  it('F6 (보너스): compare/overlay 모드에서는 guide-thumb 자체가 미렌더', async () => {
    const { wrapper } = mountCamera();
    await flushPromises();
    // 기본 모드는 'overlay' → guide-thumb 미렌더, .guide-card 만 노출
    expect(wrapper.find('.guide-thumb').exists()).toBe(false);
    expect(wrapper.find('.guide-card').exists()).toBe(true);
  });
});
```

### 2.2 점수 애니메이션 컴포넌트 spec 스켈레톤

`frontend/src/components/__tests__/ScoreRevealOverlay.spec.ts` (또는 frontend-dev가 정한 경로):

```ts
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { flushPromises } from '@vue/test-utils';

// 가칭. frontend-dev 확정 후 import 경로 픽스
import ScoreRevealOverlay from '@/components/ScoreRevealOverlay.vue';

describe('ScoreRevealOverlay', () => {
  beforeEach(() => {
    // requestAnimationFrame을 즉시 콜백 호출하도록 stub → 카운트업 즉시 종료
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(performance.now() + 9999);
      return 1;
    });
  });

  it('P1: totalScore=85 주입 → 최종 텍스트 "85"', async () => {
    const wrapper = mount(ScoreRevealOverlay, {
      props: { totalScore: 85, similarityScore: 82, gpsScore: 75, loading: false },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="score-total"]').text()).toBe('85');
  });

  it('P2: similarity/gps 분리 노출', async () => {
    const wrapper = mount(ScoreRevealOverlay, {
      props: { totalScore: 85, similarityScore: 82, gpsScore: 75, loading: false },
    });
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('82');  // similarity
    expect(text).toContain('75');  // gps
  });

  it('P3: loading=true → "채점 중..." + spinner', async () => {
    const wrapper = mount(ScoreRevealOverlay, {
      props: { totalScore: null, similarityScore: null, gpsScore: null, loading: true },
    });
    expect(wrapper.text()).toContain('채점 중');
  });

  it('P4: totalScore=0 → "0" 표시 (회귀)', async () => {
    const wrapper = mount(ScoreRevealOverlay, {
      props: { totalScore: 0, similarityScore: 0, gpsScore: 0, loading: false },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="score-total"]').text()).toBe('0');
  });

  it('P5: 닫기 버튼 클릭 → emit("close")', async () => {
    const wrapper = mount(ScoreRevealOverlay, {
      props: { totalScore: 85, similarityScore: 82, gpsScore: 75, loading: false },
    });
    await flushPromises();
    await wrapper.find('[data-testid="score-close"]').trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });
});
```

### 2.3 회귀 체크리스트 (수동/자동 혼합)

- [ ] **CameraPage 모드 토글** (기존 spec 통과 — `npx vitest run CameraPage.spec.ts`)
- [ ] **업로드 플로우 — 비교/오버레이/일반 모드 각각 1장 업로드** (수동, 모바일 dev 서버)
- [ ] **업로드 progress 인디케이터** (수동 + UploadPage spec 회귀)
- [ ] **5장 업로드 OK / 6장 거절 / 25MB 초과 거절** (백엔드 통합 테스트 + 수동)
- [ ] **ShotDetailPage 좋아요/저장/팔로우/댓글** (현재 git M인 store 4개 — 인접 회귀 1순위)
- [ ] **FollowListPage / UserProfilePage / FeedDetailPage sanity** (수동 + 기존 spec)
- [ ] **GPS 권한 거부 / 좌표 누락 시 업로드 성공, 점수 부분 0** (수동)
- [ ] **iOS safe-area: 우상단 썸네일이 노치/홈인디케이터 침범 X** (수동 — 시뮬레이터/실기기)

---

## 3. 의존 task 완료 시 확인 체크포인트

### backend-dev #1 완료 — ✅ 검증 완료
- [x] `PlacePhoto.java` 컬럼 확인 — `totalScore/similarityScore/gpsScore/capturedLatitude/capturedLongitude` 모두 추가, getter 자동 노출
- [x] `PhotoUploadRequest` 시그니처 확인 — 7-arg `(placeId, caption, tags, visibility, addToStampbook, latitude, longitude)`
- [x] `PhotoUploadResponse` 응답 shape — flat, `$.results.totalScore` 등 직속

### backend-dev #2 완료 알림 수신 시 (남은 체크)
- [ ] `ShotScoringService` public 메서드 시그니처 확인 → 스켈레톤의 `calcGpsScore`/`calcSimilarity`/`calcTotal` 이름·인자 픽스
- [x] 가중치 비율 — `gps*0.4 + sim*0.6` 확정. T1~T6 기대값 픽스 완료.
- [ ] 가이드 이미지 fetch 추상화 이름·시그니처 확인 → `@Mock GuideImageLoader` 가칭 타입 픽스
- [ ] `PhotoUploadService` 통합 — 점수 산출 호출 위치, 실패 시 fallback 정책
- [ ] 좌표 정규화 로직 진입점 — 어디서 (controller? service?) lat>90/NaN/한쪽 null 을 둘 다 null 로 만드는지
- [ ] **응답 shape 재검증** — `totalScore` 가 post 단위 단일인지, image 별 배열인지 (team-lead 메시지 모호점)
- [ ] `@DecimalMin/Max` 제거 commit 확인 — PhotoUploadRequest 어노테이션 사라졌는지

### frontend-dev #3 완료 — ✅ 검증 완료
- [x] CameraPage 가이드 썸네일 셀렉터 — `.guide-thumb` / `.guide-thumb__img` / `.guide-thumb__toggle` (`data-testid="camera-guide-thumb-toggle"`)
- [x] 토글 동작 — 컨테이너는 mode==='plain' 사전조건, 이미지는 v-if=guideThumbVisible
- [x] aria-label 동적 변경 + aria-pressed 노출 — F5 어설션 가능

### frontend-dev #5 완료 알림 수신 시 (남은 체크)
- [ ] 점수 컴포넌트 이름·경로 확인 → import 픽스 (가칭 `ScoreRevealOverlay.vue`)
- [ ] props 시그니처 확인 → P1~P5 props 형태 픽스
- [ ] 카운트업 애니메이션 종료 감지 방법 → `requestAnimationFrame` stub 또는 `vi.useFakeTimers()` 전략

### frontend-dev #4 (in_progress, GPS 좌표 캡처)
- [ ] 추가 회귀 케이스 발생 가능성 — 업로드 store 에 `latitude/longitude` 추가되면 `useUploadStore` mocking 보강

---

## 4. 미해결 질문 갱신 (2차 — team-lead forward 후)

| ID | 질문 | 대상 | 상태 |
|---|---|---|---|
| Q1 | 가중치 정확한 비율 | backend-dev #2 | ✅ `gps*0.4 + sim*0.6`, round, clamp [0,100] |
| Q2 | 잘못된 좌표 검증 정책 | backend-dev #2 | ✅ **(b) 정책으로 변경** — 서비스 단 null 정규화 + gpsScore=0, 200 OK. `@DecimalMin/Max` 제거됨. |
| Q3 | 응답 필드 nested 여부 | backend-dev #1 | ✅ flat — `$.results.totalScore` 직속. 단, "results[i]" 표현 의미 #2 commit 후 재검증. |
| Q4 | CameraPage 가이드 썸네일 셀렉터 | frontend-dev #3 | ✅ `.guide-thumb` / `data-testid="camera-guide-thumb-toggle"` |
| Q5 | 점수 컴포넌트 이름·props 시그니처 | frontend-dev #5 | 🟡 #5 진행 후 확정 |
| Q6 | 카운트업 애니메이션 종료 감지 방법 | frontend-dev #5 | 🟡 #5 진행 후 확정 |
| Q7 (신규) | 점수 응답 위치 — post 단위 vs image 단위 | backend-dev #2 | 🟡 #2 commit 후 코드 재검증 |
