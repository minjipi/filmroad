# QA Prep — Task #9 (/upload 통합 회귀)

## 0. 컨텍스트

- **#8 작업 범위**: /upload 와 /reward 분리 → /upload 단일 페이지로 통합. 06-reward.html 디자인 이식.
- **check-wrap 영역의 두 단계**:
  - **단계 A**: 점수 카운트업 (현재 ScoreRevealOverlay의 score-total/breakdown)
  - **단계 B**: 인증완료 체크 SVG + h1 "인증 완료!" + sub "<bold-k>'placeName'</bold-k> 성지를…"
- **stamp-card / rewards 카드**: 단계 B 노출 시 함께 표시
- **/reward 라우트 처리** (예상): UploadPage 내부 처리로 흡수 → /reward/:placeId deprecate, RewardPage.vue / RewardPage.spec.ts 제거 가능성

## 1. 단계 A → 단계 B 전환 spec 시나리오

### 전환 트리거 후보 (구현 대기)
- 옵션 1: ScoreRevealOverlay 의 emit('close') 핸들러가 단계 B 로 이행 (router push 대신)
- 옵션 2: 카운트업 완료 (score-total 도달) → 자동 setTimeout(예: 800ms) 후 단계 B 표시
- 옵션 3: 사용자가 명시 "다음" CTA 클릭

> 어느 옵션이든 spec 패턴은 동일: stage state 변경 후 단계 B 셀렉터 확인.

### Spec 시나리오 표

| ID | 시나리오 | 핵심 어설션 |
|---|---|---|
| U1 | 마운트 직후 단계 A — 업로드 폼 노출 | placeName CTA / 사진 썸네일 / caption textarea / "공유하기" 버튼 |
| U2 | 공유하기 → submit → loading → ScoreRevealOverlay 단계 A 점수 노출 | 기존 frontend-dev L219 케이스. 이미 그린 |
| U3 | 점수 close emit (또는 카운트업 완료) → 단계 B 인증완료 마크업 렌더 | `.check-wrap`/`.check-ring` 노출, `h1` 텍스트 "인증 완료!" |
| U4 | 단계 B 시점에 단계 A 영역(업로드 폼) 미렌더 | preview/caption/공유하기 버튼 없음 |
| U5 | 단계 B placeName 보간 — 평이 한글 | `.bold-k` 텍스트 ='주문진 영진해변' (작은따옴표 포함) |
| U6 | 단계 B placeName 보간 — 특수문자 (`<script>`, `&`, `"`) | Vue 자동 escape 검증 — text 매칭은 정확히 입력값, innerHTML 에 raw `<script>` 없음 |
| U7 | 단계 B placeName 보간 — 공백 양옆 (`  주문진  `) | trim 여부 (구현 따라). 결과 텍스트가 그대로 또는 trim 후 |
| U8 | 단계 B placeName 보간 — 긴 이름 (50+ 문자) | 텍스트 그대로 노출, CSS 오버플로/wrap 은 수동 |
| U9 | 단계 B 접근성 — check SVG `aria-hidden="true"`, h1 텍스트 노출, sub `<br>` 후 텍스트 연속성 | 스크린 리더 회귀 |
| U10 | 단계 B "홈으로" 또는 닫기 CTA → router replace + uploadStore reset | 기존 RewardPage 케이스 흡수 |
| U11 | 단계 B stamp-card / rewards 노출 | `.stamp-card` `.rewards` 셀렉터, `.bd-v` 점수/badges 표시 |

### 점수 카운트업 → 단계 B 자동 전환 패턴

```ts
// 옵션: 카운트업 완료 후 N ms 자동 전환
import { vi } from 'vitest';

it('U3: 점수 카운트업 완료 → 자동 전환 (N ms 후)', async () => {
  vi.useFakeTimers();
  const { wrapper } = mountUploadPage(...);
  // submit → loading → score
  await flushPromises();
  vi.advanceTimersByTime(2000);  // count-up 1.3s + buffer 또는 disableAnimation
  await flushPromises();
  expect(wrapper.find('.check-wrap').exists()).toBe(true);
  vi.useRealTimers();
});
```

또는 ScoreRevealOverlay 처럼 `disableAnimation` prop / `disableAutoTransition` props 제공되면 즉시 검증.

## 2. placeName 보간 케이스 표

| ID | 입력 | 기대 텍스트 | 비고 |
|---|---|---|---|
| P1 | "주문진 영진해변" | "'주문진 영진해변' 성지를…" | 정상 케이스 |
| P2 | "단밤 포차 (서울밤)" | "'단밤 포차 (서울밤)' 성지를…" | 괄호 |
| P3 | `<script>alert(1)</script>` | escape 처리, innerHTML 에 raw `<script>` 없음 | XSS 방어 회귀 |
| P4 | "헬로&월드" | text 그대로 "헬로&월드" | & escape 자동 |
| P5 | "  앞뒤 공백  " | trim 정책에 따라 (구현 후 결정) | 공백 처리 |
| P6 | "이건정말긴이름이름이름이름이름이름이름이름이름이름이름…" (60자) | text 그대로, CSS overflow 는 수동 | 줄바꿈 회귀 |
| P7 | "이모지 🎬✨ 포함" | text 그대로 | 이모지 sanity |

## 3. 회귀 체크리스트

### 자동화 회귀
- [ ] 기존 UploadPage 11 케이스 그린 — 특히 frontend-dev L219 (공유하기→loading→close→/reward) 케이스 갱신 필요 여부 확인
- [ ] ScoreRevealOverlay 9 케이스 (앱 흐름 변화 무관 — 컴포넌트 단위)
- [ ] CameraPage 15 케이스 (영향 없음, 회귀)
- [ ] upload store 14 케이스 (영향 없음, 회귀)
- [ ] **RewardPage 영향 분석**:
  - 옵션 A: 라우트 deprecate + 페이지 제거 → spec 도 제거. 라우터에서 import 제거.
  - 옵션 B: 라우트 유지 + 내부 redirect to /upload → spec 일부 유지 (redirect 케이스만)
  - 옵션 C: 라우트 유지 + 페이지 그대로 → spec 그대로 (이중 진입점)
  - **결정 기준**: #8 commit 의 router 변경 + RewardPage.vue 변경 여부

### 수동 회귀 (M11~M15 신규)
| ID | 항목 | 점검 |
|---|---|---|
| M11 | 카운트업 → 단계 B 전환 타이밍 자연스러움 | 1.3s ease-out 후 부드러운 fade/scale 전환? |
| M12 | 06-reward.html 디자인 픽셀 매칭 | 디자인 PNG 와 실제 dev 서버 비교 |
| M13 | 단계 B 에서 뒤로가기 → 단계 A 복귀? 또는 /home 으로? | 라우팅 동작 결정 |
| M14 | 모바일 viewport — stamp-card / rewards 가 한 화면에 들어오는지 | iOS/Android |
| M15 | 점수 0 + 인증완료 화면 — UX 모순 없는지 (점수 0인데 "성공적으로 수집") | 카피/흐름 검토 |

## 4. 미해결 질문 (#8 commit 후 답)

| ID | 질문 | 대상 |
|---|---|---|
| Q8-1 | 단계 A→B 전환 트리거 (close emit / 자동 timeout / CTA 클릭) | frontend-dev #8 |
| Q8-2 | placeName 보간 위치 (`{{ }}` vs computed slot) — Vue 자동 escape 적용 여부 | frontend-dev #8 |
| Q8-3 | RewardPage / `/reward/:placeId` 라우트 처리 (제거? redirect? 유지?) | frontend-dev #8 |
| Q8-4 | 단계 B "홈으로 돌아가기" CTA 위치/동작 | frontend-dev #8 |
| Q8-5 | check-wrap SVG 구현 (lucide-vue-next? ionicons? inline SVG?) | frontend-dev #8 |
| Q8-6 | 카운트업 종료 → 단계 B 전환 사이 transition 효과 (있다면 spec 에서 timer flush 필요) | frontend-dev #8 |
