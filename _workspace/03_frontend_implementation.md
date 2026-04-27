# 03 Frontend Implementation — feat/place-kakao-info

## 완료 항목

### 1. Pinia store
- `frontend/src/stores/kakaoInfo.ts`
  - `PlaceKakaoInfoResponse` / `KakaoNearbyDto` 타입 정의 (백엔드 DTO 와 1:1).
  - `infoByPlace` placeId 별 캐시 (null 도 "이미 시도" 의미로 보존 — 재호출 안 함).
  - `infoFor(placeId)` getter, `fetch(placeId)` action.
  - 실패 시 null 저장 + `console.warn`. 섹션은 v-if 로 자동 숨김.
  - axios envelope unwrap 인터셉터 그대로 활용 (`api.get<PlaceKakaoInfoResponse>`).

### 2. PlaceDetailPage 카카오 섹션 추가
- `frontend/src/views/PlaceDetailPage.vue`
  - `<section v-if="kakaoInfo?.available">` — `data-testid="pd-kakao-section"`.
  - 마크업: 카카오 배지 + 동기화 라벨 / 카카오맵 정보 chip / 도로명·지번 행 / 전화 행 / 카카오맵 링크 행 / 4-CTA 그리드 (길찾기·저장·공유·카카오맵) / 주변 맛집·카페 가로 carousel / 푸터.
  - CSS: design/pages/02-map.html 의 `.kakao-*` 톤을 scoped block 안으로 이식. 다른 `.section` 들과 `border-top + padding: 22px 0` 으로 시각 일관.
  - 스크립트:
    - `useKakaoInfoStore` 와이어업, `kakaoInfo` computed.
    - `syncLabel` computed — `formatRelativeTime` 재사용 ("방금 동기화" / "5분 전 동기화" / "어제 동기화").
    - `formatNearby(n)` — 카테고리 첫 토큰("한식") + 도보 분 (80m/min, 최소 1분).
    - `onCopyAddress` — `navigator.clipboard.writeText` → `showInfo('주소를 복사했어요')` / 실패 시 `showError`.
    - `onKakaoNavigate` — `https://map.kakao.com/link/to/<name>,<lat>,<lng>` 새 창.
    - `onShare` / `onToggleSave` 는 기존 핸들러 재사용.
    - `load(id)` 안에서 `kakaoInfoStore.fetch(id)` 병렬 트리거 (보조 정보, swallow).

### 3. 단위 테스트 (4 케이스 추가)
- `frontend/src/views/__tests__/PlaceDetailPage.spec.ts`
  - `mountPlaceDetailPage` 가 `kakaoInfo` override 받도록 확장 + `makeKakaoInfo` 팩토리.
  - "kakaoInfo 없거나 available=false 면 섹션 숨김"
  - "정상 응답일 때 주소·지번·전화·카테고리·4-CTA 모두 렌더, 카카오맵 링크 href 매칭"
  - "nearby 0건이면 .k-nearby 헤더 숨김, 2건이면 카드 2개 렌더 (도보 분 계산 검증)"
  - "주소 복사 버튼 클릭 → `navigator.clipboard.writeText` 가 roadAddress 로 호출"

## 검증
- `npx vue-tsc --noEmit` — 그린, 0 에러.
- `npx vitest run` — 49 files / 471 tests 모두 그린 (이전 467 + 신규 4).
- `npx eslint src/stores/kakaoInfo.ts src/views/PlaceDetailPage.vue src/views/__tests__/PlaceDetailPage.spec.ts` — 클린. (전역 `npm run lint` 의 5 error 는 모두 사전 존재 — MapPage / CameraPage.spec / SavedPage.spec, 이번 PR 미터치.)

## 변경 파일
- `frontend/src/stores/kakaoInfo.ts` (신규)
- `frontend/src/views/PlaceDetailPage.vue` (수정)
- `frontend/src/views/__tests__/PlaceDetailPage.spec.ts` (수정)

---

# Task #3 — CameraPage 우상단 가이드 사진 썸네일 + 토글

## 완료 항목

### 1. CameraPage 우상단 가이드 썸네일
- `frontend/src/views/CameraPage.vue`
  - `top` 바 바로 아래(`top: calc(72px + env(safe-area-inset-top))`, `right: 14px`)에 96×128px 썸네일 + 토글 버튼 묶음(`.guide-thumb`) 추가.
  - 이미지 소스: 기존 `targetPlace.sceneImageUrl`를 재사용 (`overlaySrc` computed).
  - 이미지 스타일: `border-radius: 12px`, `box-shadow: 0 4px 14px rgba(0,0,0,0.45)`, 1px 흰색 반투명 보더, 드래그 방지(`draggable="false"` + `-webkit-user-drag: none`).
  - 표시 조건: `overlaySrc && mode === 'plain'` — compare/overlay 모드는 이미 전체 화면 오버레이가 있으므로 중복 노출 회피.

### 2. 눈 아이콘 토글
- `eyeOutline` / `eyeOffOutline` 아이콘 import.
- 32px 원형 버튼(`.guide-thumb__toggle`) — backdrop-blur, 검정 반투명 배경 (`top` 바 r-btn과 톤 매칭).
- `guideThumbVisible` 로컬 ref (default `true`). 클릭 시 토글, 페이지 재진입 시 자연스럽게 리셋.
- `aria-label` / `aria-pressed`로 접근성 처리, `data-testid="camera-guide-thumb-toggle"` 부여.
- 숨김 상태일 때도 토글 버튼은 그대로 노출되어 다시 켤 수 있음 (`v-if`는 `<img>`에만 걸어둠).

## 검증
- `npm run build` — vue-tsc 타입체크 + Vite 빌드 그린.
- `npm run test:unit -- --run src/views/__tests__/CameraPage.spec.ts` — 8/8 통과.
- `npm run lint` — `CameraPage.vue` 신규 위반 0건. (전체 4 error는 모두 사전 존재 — `__tests__/CameraPage.spec.ts:212` `_blob` 미사용, `SavedPage.spec.ts` 미사용 import 3건. 이번 task 미터치.)

## 변경 파일
- `frontend/src/views/CameraPage.vue` (수정)

### Post-QA 보정 (Task #3)
- 컨테이너 `data-testid="guide-thumb"` 추가, 토글 버튼 testid 를 `camera-guide-thumb-toggle` → `guide-thumb-toggle` 로 통일.
- 토글 `aria-label` 을 단일 정적 라벨 `"가이드 사진 보이기/숨기기"` 로 고정 (상태는 `aria-pressed`로 표현).

---

# Task #4 — 업로드 시 GPS 좌표 캡처 + 전송

## 완료 항목
- `frontend/src/stores/upload.ts`
  - 기존 `requestLocation` 컴포저블 (`@/composables/useGeolocation`) 재사용 — 이미 5s 기본 timeout, denied/unavailable/timeout 분기, jsdom 안전한 navigator-없음 fast-fail 보장.
  - `submit()` 액션에서 multipart 빌드 직전 `await requestLocation({ timeoutMs: 5000 })`.
    - `ok=true` → meta JSON 에 `latitude`, `longitude` 포함 (백엔드 `PhotoUploadRequest` 와 일치).
    - `ok=false` → `console.warn('[upload] geolocation skipped (<reason>); proceeding without coords')` + lat/lng 키 자체를 메타에서 제외 (`JSON.stringify` 가 undefined 키 자동 drop). 업로드는 그대로 진행.
  - `PhotoResponse` 인터페이스에 `totalScore?`, `similarityScore?`, `gpsScore?` 옵션 필드 추가 — Task #5 응답 shape 대응 (null 허용 = "채점 안 됨", undefined = "응답이 채점 기능 이전").

## 검증
- `npm run test:unit` — 50 files / 486 tests 그린 (`upload store > submit includes latitude/longitude in meta when geolocation succeeds`, `submit silently omits ... when geolocation fails` 신규 2케이스 포함).
- `console.warn` 가 silent fail 경로에서 1회 호출되는지 검증.

## 미설치 패키지 알림
- `@capacitor/geolocation` 은 미설치 상태. 웹/Capacitor WebView 모두 `navigator.geolocation` fallback 으로 동작 중.
- 네이티브 권한 다이얼로그 / 백그라운드 정확도가 필요해지면 별도 협의 후 `@capacitor/geolocation` 추가 + `requestLocation` 분기.

## 변경 파일
- `frontend/src/stores/upload.ts`
- `frontend/src/stores/__tests__/upload.spec.ts`

---

# Task #5 — 점수 채점 애니메이션 + 결과 표시

## 완료 항목
### 1. `frontend/src/components/upload/ScoreRevealOverlay.vue` (신규 컴포넌트)
- Props: `loading: boolean`, `totalScore?: number | null`, `similarityScore?: number | null`, `gpsScore?: number | null`, `disableAnimation?: boolean` (테스트 escape hatch).
- Emits: `close` — 라우팅은 부모 책임 (QA 협업 요청 반영).
- Loading 모드: `ion-spinner` (crescent) + 0–99 셔플 placeholder (80ms 간격) + "채점 중..." 라벨.
- Result 모드: `requestAnimationFrame` 카운트업 0 → totalScore (1.3s ease-out cubic), 종료 시 `.is-bounced` 키프레임으로 살짝 scale bounce + 글로우 강화.
- 분리 표시: 유사도 / 위치 점수, 흐릿하면 `—` (`null`/`undefined` 모두 안전 — 0 은 "0"으로 표기, falsy guard 금지).
- testid: `score-loading`, `score-total`, `score-similarity`, `score-gps`, `score-close` (QA 셀렉터 스펙 그대로).
- 접근성: `role="dialog"`, `aria-modal="true"`, `aria-busy={loading}`, `aria-label="인증샷 채점 결과"`.

### 2. `frontend/src/views/UploadPage.vue` 와이어업
- `scoreOverlayOpen / Loading / Total / Similarity / Gps / PlaceId` 로컬 ref 추가.
- `onShare` / `onRetry`:
  1. 오버레이 즉시 open (`loading=true`).
  2. `submit()` / `retry()` 호출.
  3. 성공 → 응답에서 `totalScore/similarityScore/gpsScore` 픽업 후 `loading=false` (오버레이는 유지, 사용자가 닫기 전까지 결과 표시).
  4. 실패 → 오버레이 close, 기존 toast/banner 흐름 유지.
- `onScoreOverlayClose` → `showInfo` + `router.replace('/reward/<placeId>')` (기존 라우팅 그대로, 닫기로 이연).
- 백엔드 점수 미포함이어도 `null`/`undefined` 안전.

### 3. 단위 테스트
- `frontend/src/components/__tests__/ScoreRevealOverlay.spec.ts` (신규, 6 케이스)
  - loading=true 일 때 `score-loading` 만 노출 / `aria-busy="true"` 검증.
  - `disableAnimation=true` 로 totalScore=84/similarity=82/gps=86 즉시 표기.
  - `totalScore=0` → "0" 표기 (falsy guard 회귀 가드).
  - null/undefined → `—` 폴백.
  - `score-close` 클릭 → `close` emit (라우팅 안 함).
  - loading false→true→false 플립 시 새 totalScore 픽업.
- `frontend/src/views/__tests__/UploadPage.spec.ts`
  - `"공유하기" → 오버레이 open → score-total 노출 → score-close → /reward/10` 단계 검증으로 보강.
  - 재시도 흐름도 동일 패턴으로 갱신.

## 검증
- `npx vue-tsc --noEmit` — 그린.
- `npm run test:unit` — 50 files / 486 tests 그린.
- `npm run build` — 그린.
- `npm run lint` — 신규 위반 0건 (사전 4 error 만 그대로, 미터치).

## 변경 파일
- `frontend/src/components/upload/ScoreRevealOverlay.vue` (신규)
- `frontend/src/components/__tests__/ScoreRevealOverlay.spec.ts` (신규)
- `frontend/src/views/UploadPage.vue` (수정)
- `frontend/src/views/__tests__/UploadPage.spec.ts` (수정)

---

# Task #8 — /upload 페이지를 06-reward.html과 통합 + 점수 → 인증완료 전환

## 완료 항목

### 1. UploadPage.vue 3-stage 페이지 (compose → scoring → authenticated)
- 동일 `/upload` 페이지가 폼 입력 → 채점 → 인증 완료까지 모두 호스팅. `/reward/:id` 라우팅 제거.
- `stage` 로컬 상태 ref (`'compose' | 'scoring' | 'authenticated'`):
  - **compose**: 기존 폼/카드/장소 picker UI 그대로 (변경 없음).
  - **scoring**: `submit()` in-flight ~ 카운트업 종료. `ScoreRevealOverlay` 가 inline 으로 마운트되어 loading → result 카드 전환을 담당.
  - **authenticated**: 06-reward.html 마크업 그대로 — confetti 배경, 체크 링, "인증 완료!" 타이틀, sub("‘placeName’ 성지를…✨"), `stamp-card`, `rewards`, `new-badges`, `actions` (친구에게 자랑하기 / 홈으로 돌아가기).
- `onCountUpComplete` 핸들러: 카운트업 완료 시 700ms 비트 후 `stage='authenticated'` 로 전환 (`STAGE_BEAT_MS=700`).
- 실패 시 stage='compose' 로 복귀 → 기존 inline error banner / 재시도 흐름 그대로 노출.
- `onGoHome`: `uploadStore.reset()` + `router.replace('/home')`.
- `onBoast`: `showInfo('공유는 곧 공개됩니다')` (현재 stub).
- `onBeforeUnmount`: pendingStageTimer cleanup.

### 2. ScoreRevealOverlay.vue → 인라인 임베드 형태로 reshape
- 다이얼로그/백드롭/`role="dialog"`/`aria-modal`/close 버튼 제거. 06-reward 의 `check-wrap` 위치에 박혀 들어가는 카드형 inline 컴포넌트.
- 카운트업 로직(0 → totalScore, 1.3s ease-out cubic), 셔플 placeholder, bounce 키프레임 그대로 보존.
- 신규 `count-up-complete` emit (close emit 대체). 부모(UploadPage)가 stage 전환 트리거로 사용.
- `aria-busy` 명시적 string 변환 (`loading ? 'true' : 'false'`) — Vue 의 boolean attribute 처리 + 멀티-루트 SFC 회피로 일관된 attribute 노출.
- 폰트 사이즈 88px → 64px 로 축소 (인라인 컨테이너 폭에 맞춤).

### 3. 라우터 / RewardPage 처리
- `/reward/:placeId` 라우트 + RewardPage.vue / spec — **삭제하지 않고 그대로 유지** (team-lead 지시: feature flag/미사용 상태). UploadPage 에서만 push 호출 제거.
- 추후 사용자 피드백 확인 후 별도 task 로 제거 결정.

### 4. 단위 테스트
- `frontend/src/components/__tests__/ScoreRevealOverlay.spec.ts` (9 케이스)
  - 기본 6 + QA #7 a11y/aria-label/partial-null + 신규 count-up-complete emit.
  - QA 의 `role=dialog/aria-modal=true` 단언은 인라인 임베드 후 의미 잃어 제거하고, "no dialog wrapper" 단언으로 대체.
- `frontend/src/views/__tests__/UploadPage.spec.ts` (11 케이스, 신규 2 + 갱신 1)
  - **신규**: `"공유하기" → stage transitions compose → scoring → authenticated; no /reward redirect (task #8)` — fake timer 로 700ms 비트까지 advance, 단계 전환과 placeName 보간 검증.
  - **신규**: `"홈으로 돌아가기" in stage B resets the upload store and replaces to /home (task #8)` — reset + `/home` 라우팅 검증.
  - **갱신**: 재시도 흐름 — `/reward/:id` 단언 제거, 단계 전환만 검증.
  - ScoreRevealOverlay 를 stub 으로 대체해 RAF 의존 제거 (vitest fake timers 가 RAF 를 fake 하지 않으므로).

## 검증
- `npx vue-tsc --noEmit` — 그린.
- `npm run test:unit` — 50 files / 497 tests 통과 (이전 486 + 신규 11).
- `npm run build` — 그린, `dist/assets/UploadPage-C-4QUZgi.js` 16.69 kB.
- `npm run lint` — `UploadPage.vue` / `ScoreRevealOverlay.vue` / spec 모두 클린. (전체 3 error 는 사전 존재, `__tests__/SavedPage.spec.ts` 미터치.)

## 변경 파일
- `frontend/src/views/UploadPage.vue` (수정)
- `frontend/src/components/upload/ScoreRevealOverlay.vue` (수정 — 인라인 reshape)
- `frontend/src/components/__tests__/ScoreRevealOverlay.spec.ts` (수정 — a11y 단언 갱신, count-up-complete 추가)
- `frontend/src/views/__tests__/UploadPage.spec.ts` (수정 — stage 전환 / 홈 라우팅)
- `_workspace/03_frontend_implementation.md` (추가)

---

# Task #10 — scoring 단계에도 stamp-card + rewards 섹션 유지

## 완료 항목

### UploadPage.vue 템플릿 재구성
- `stamp-card` / `rewards` 섹션을 `<template v-if="stage === 'authenticated'">` 블록 밖으로 끌어내 stage A + B 공통 영역에 배치.
- 노출 조건: 새 computed `showCompletionExtras = (stage === 'authenticated') || (stage === 'scoring' && !scoreLoading)` — 응답 도착 후(loading=false)에만 두 섹션 노출하여, scoring 로딩 phase 에 stale `lastResult` 가 비치는 일을 방지.
- Stage A 헤더(check-wrap + ScoreRevealOverlay) → 공통 stamp-card / rewards → Stage B 헤더(check-wrap + 인증 완료! 타이틀 + sub) → Stage B 트레일링(new-badges + 액션 버튼) 순서.
- new-badges + 액션 버튼은 stage B 전용 유지 — 카운트업 도중 "홈으로 돌아가기"로 이탈 못 하도록 의도적으로 분리.
- testid 보강: `completion-stamp-card`, `completion-rewards` — QA 시나리오에서 직접 셀렉트 가능.

### 단위 테스트
- `frontend/src/views/__tests__/UploadPage.spec.ts` (신규 2 케이스)
  - `scoring stage keeps stamp-card and rewards on screen alongside the count-up once the response lands (task #10)` — 응답에 stamp + reward 포함 시, scoring 단계에서 두 섹션 노출 + place-name/액션버튼은 미노출 검증. 700ms beat 후 stage B 전환에도 두 섹션 그대로 유지 검증.
  - `scoring stage hides stamp-card / rewards when the response carries no stamp or reward (task #10 auto-hide)` — 응답에 stamp/reward 없으면 두 섹션 모두 미렌더 (graceful fallback).
- 테스트 mock 보강: `vi.spyOn(store, 'submit').mockImplementation` 으로 `store.lastResult = fakeRes` 까지 설정 — completionStamp/Reward computeds 가 lastResult 를 읽기 때문.

## 검증
- `npx vue-tsc --noEmit` 그린.
- `npm run test:unit` — 50 files / **506 tests** 통과 (이전 497 + 신규 2 + QA 작업분).
- `npm run build` 그린.
- `npm run lint` — 신규 위반 0건 (사전 3 error 그대로).

## 변경 파일
- (M) `frontend/src/views/UploadPage.vue`
- (M) `frontend/src/views/__tests__/UploadPage.spec.ts`
- (M) `_workspace/03_frontend_implementation.md`

---

# Task #11 — design: 13-feed-detail.html split view → 토글 버튼으로 대체

## 완료 항목

### `design/pages/13-feed-detail.html` 비교 영역 재구성
- **기존**: 4:5 컨테이너에 두 이미지를 stacked 후 위쪽 이미지에 `clip-path: inset(0 0 50% 0)` 으로 상단 절반만 보이게 하고, 가운데에 `.compare-divider` 흰선 + 양쪽 24px 원형 핸들. 상단=드라마 원본, 하단=내 인증샷이 동시에 보이는 split view.
- **신규**: 같은 컨테이너에서 두 이미지를 모두 absolute 로 겹쳐두고 opacity 220ms ease-out 으로 fade. 컨테이너 `data-mode="shot"` (기본) 또는 `"guide"` 로 활성 이미지가 결정됨.
- 우하단 토글 버튼 `.compare-toggle` 추가 — 검정 반투명 pill, eye 아이콘 + 텍스트 ("가이드 보기" / "원본으로"). `aria-pressed` 동기화, guide 모드에서 primary blue 배경으로 톤 변경.

### CSS 변경
- 제거: `.compare-top { clip-path }`, `.compare-divider`, `.compare-divider::before/::after`.
- 추가: `.compare-img { opacity:0 }` + `[data-mode="shot"] .is-shot { opacity:1 }`/`[data-mode="guide"] .is-guide { opacity:1 }` 매핑.
- 모드별 표시: shot 모드에서 `.compare-lbl-top` 숨김, guide 모드에서 `.compare-lbl-bot` 숨김.
- `drama-badge` 는 `.compare-wrap` 내부에서만 shot 모드에 숨김 (회차/타임코드는 드라마 이미지가 보일 때만 의미). 단독 이미지 포스트(`.single-img` 외부)의 drama-badge 는 영향 없음 (셀렉터 한정).

### JS 핸들러
- `<script>` 블록에서 `lucide.createIcons()` 직전에 `document.querySelectorAll('.compare-wrap .compare-toggle')` 로 각 wrap 내 토글에 click 핸들러 바인딩.
- 클릭 시 `data-mode` 토글 + `aria-pressed` 토글 + 라벨 textContent 교체.

### 마크업
- Post 1 (도깨비, 주문진 영진해변)와 Post 3 (갯마을차차차, 청하공진시장) 두 compare-wrap 모두 동일 패턴으로 변환.
- Post 2 (단일 이미지) 는 `.single-img` 사용으로 영향 없음 — drama-badge 그대로 노출.
- 각 이미지에 한국어 alt text 부여 ("드라마 원본 장면" / "내가 찍은 인증샷").

## 검증
- Vue 빌드 무관 (정적 HTML). 브라우저에서 `design/pages/13-feed-detail.html` 직접 열어 토글 클릭 시 fade 전환 확인 가능.
- 기존 디자인 톤 (Pretendard 폰트, primary 컬러 #14BCED, 12-14px 라벨, backdrop-filter blur) 유지.
- 다른 섹션(헤더/탭/스토리/추천/피드 액션/코멘트 영역) 회귀 없음 — 셀렉터 충돌 없는 신규 클래스 (`.compare-img`, `.compare-toggle`, `.compare-toggle-lbl`).

## 변경 파일
- (M) `design/pages/13-feed-detail.html`
- (M) `_workspace/03_frontend_implementation.md`

---

# Task #12 — ShotDetailPage UI를 13-feed-detail.html 디자인으로 재구성

## 완료 항목

### `frontend/src/views/ShotDetailPage.vue` compare 영역 변환
- 기존 단일/멀티 이미지 두 경로 모두에서 `clip-path: inset(0 50% 0 0)` 좌우 split + 흰선 divider + swap-handle 핸들 → task #11 의 toggle 패턴으로 통일.
- 이미지 마크업: `compare-img is-guide` (드라마 원본) + `compare-img is-shot` (촬영 사진) 두 장을 absolute 로 겹쳐두고, `data-mode`="shot"|"guide" 로 활성 레이어 결정. opacity 220ms ease-out fade.
- 우하단에 floating `.compare-toggle` 버튼: eye 아이콘 + "가이드 보기" / "원본으로" 텍스트 토글, `aria-pressed` 동기화, guide 모드에선 primary blue 배경 강조.
- `sceneImageUrl` 이 null 이면 토글 미렌더 (전환할 가이드 이미지가 없으므로). 기존 동작 — null 일 때 `<img>` 한 장만 노출 — 그대로 유지.
- `compareMode` 로컬 ref 신규 + shot 변경 시 watch 에서 `'shot'` 으로 자동 리셋 (다른 shot 으로 이동했을 때 stale 모드 잔류 방지).

### CSS 정리
- 제거: `.compare img { clip-path }`, `.compare .top-img`, `.divider`, `.divider-handle` 룰 + `swapHorizontal` 아이콘 import.
- 추가: `.compare .compare-img { opacity:0; transition:opacity 220ms }` + `[data-mode="shot"] .is-shot { opacity:1 }` / `[data-mode="guide"] .is-guide { opacity:1 }` 매핑.
- 라벨 모드별 자동 숨김: shot 모드에서 `.lbl-chip.l` (드라마 원본) 숨김, guide 모드에서 `.lbl-chip.r` (내 인증샷) 숨김.
- `.compare-toggle` 버튼 — 검정 반투명 pill, 12px 우하단, primary blue tint when pressed. 13-feed-detail 의 `.compare-toggle` 와 동일 톤.

### 다른 섹션
- `.sd-user`, `.sd-stats`, `.sd-caption`, `.loc-card`, `.scene-card`, `.comments`, `.cmt-input-wrap` 모두 비즈니스 기능 (좋아요/저장/팔로우/댓글/장소 카드/원본 장면 카드) 보존 — 기존 회귀 spec 의존성도 그대로 유지.
- `section.compare` 로 두 `<img>` 직계 child 패턴은 유지 — 기존 spec `wrapper.findAll('section.compare img').length === 2` + `imgs[0].src === sceneImageUrl` / `imgs[1].src === imageUrl` 단언 모두 통과.

### 단위 테스트
- `frontend/src/views/__tests__/ShotDetailPage.spec.ts` (신규 2 케이스, 기존 15 케이스 전부 통과)
  - `compare hero toggles data-mode + aria-pressed + label on click (task #12)` — 기본 mode='shot' / aria-pressed=false / "가이드 보기" → 클릭 후 'guide' / true / "원본으로" → 다시 클릭 시 'shot' 복귀.
  - `compare toggle is hidden when sceneImageUrl is null` — sceneImageUrl null 응답일 때 section.compare 는 그대로지만 sd-compare-toggle 은 미렌더.

## 검증
- `npx vue-tsc --noEmit` 그린.
- `npm run test:unit` — 50 files / **520 tests** 통과 (이전 508 + 신규 2 + QA 작업분).
- `npm run build` 그린.
- `npm run lint` — 신규 위반 0건 (사전 3 error 그대로).

## 변경 파일
- (M) `frontend/src/views/ShotDetailPage.vue`
- (M) `frontend/src/views/__tests__/ShotDetailPage.spec.ts`
- (M) `_workspace/03_frontend_implementation.md`

---

# Task #13 — ShotDetailPage 의 loc-card, scene-card 섹션 제거

## 완료 항목

### 템플릿 / 스크립트 / CSS 일괄 제거
- `<section class="loc-card">` (지도 썸네일 + 장소명/주소 + 외부 이동 버튼) 마크업 삭제.
- `<section class="scene-card">` (원본 장면 보기 카드 — 드라마 정보 + 가이드 이미지 + play 버튼) 마크업 삭제.
- 핸들러 정리: `onOpenPlace`, `onOpenScene` 함수 삭제.
- 아이콘 import 정리: `arrowForward`, `play`, `chevronForwardOutline` 제거 (모두 제거된 두 섹션에서만 쓰임). `filmOutline` 은 compare 의 scene-meta 에서 계속 사용 중이라 유지.
- CSS 정리: `.loc-card`, `.loc-map-thumb`, `.loc-map-thumb::after`, `.loc-card .meta`, `.loc-card .pl`, `.loc-card .ad`, `.loc-card .go`, `.scene-card`, `.scene-card .head`, `.scene-card .head .drama-ic`, `.scene-card .head .title-block`, `.scene-card .head .t/.s/.chev`, `.scene-card .body`, `.scene-card .play`, `.scene-card .play::after`, `.scene-card .play-btn`, `.scene-card .play-time` 룰 모두 삭제.
- 제거 위치에 추적용 주석만 남김 ("task #13: loc-card / scene-card 두 섹션은 사용자 결정으로 제거…").

### compare 토글 / 좋아요·저장·팔로우 / 댓글 시트 / 라우터 가드 / 멀티 이미지 캐러셀 / scene-meta / sd-user / sd-stats / sd-caption / .comments / .cmt-input-wrap — **전부 보존**.

### 단위 테스트
- `frontend/src/views/__tests__/ShotDetailPage.spec.ts`
  - **제거**: `loc-card click pushes /place/:id for the shot's place` 케이스 (해당 요소 부재로 회귀 무의미).
  - **추가**: `task #13: loc-card and scene-card sections are no longer rendered` — 두 셀렉터 부재 검증 (회귀 안전망 — 향후 누군가 실수로 다시 추가하면 fail).
  - 토글/좋아요/저장/댓글 등 다른 16 케이스 그대로 PASS.

## 검증
- `npx vue-tsc --noEmit` 그린.
- `npm run test:unit` — 50 files / **520 tests** 통과 (제거 1 + 신규 1, 다른 케이스 영향 없음).
- `npm run build` 그린.
- `npm run lint` — 신규 위반 0건.
- **Dev 서버 헬스체크** (`npm run dev`):
  - Vite v5.4.21 ready in 1827ms, 콘솔 에러/경고 0건.
  - `GET /shot/15` → HTTP 200 (954 bytes SPA shell).
  - `GET /src/views/ShotDetailPage.vue` → HTTP 200, **101 770 bytes** (이전 117 130 bytes 대비 약 15 KB 감소).
  - 변환 산출물 토큰 검증: `onOpenPlace=0`, `onOpenScene=0`, `drama-ic=0`, `play-btn=0` (모두 제거 확인). `compareMode=11`, `compare-toggle=6`, `is-shot=2`, `is-guide=2` (task #12 토글 유지). 남은 `loc-card/scene-card` 매칭 1건씩은 모두 SFC 주석(`_createCommentVNode("task #13: loc-card / scene-card 두 섹션은…")`) 내부 — 마크업/CSS 부재 확인.
- 실행 중이던 stale Vite 인스턴스 3개(이전 세션 잔류)를 발견해 정리 후 단일 fresh 서버에서 재검증.

## 변경 파일
- (M) `frontend/src/views/ShotDetailPage.vue`
- (M) `frontend/src/views/__tests__/ShotDetailPage.spec.ts`
- (M) `_workspace/03_frontend_implementation.md`

---

# Task #15 — ShotDetailPage 무한 스크롤 UI

## 백엔드 통합 결정 (task #14 결과)
- backend-dev 가 별도 엔드포인트 신설 대신 **`GET /api/feed?tab=RECENT&cursor=<id>&limit=<n>`** 재사용 — 기존 cursor 기반 페이지네이션 + visibility 필터 + ID-DESC 정렬이 무한 스크롤 요건을 그대로 충족.
- 응답 shape: `{ posts: FeedPost[], hasMore: boolean, nextCursor: string | null }` (메인 피드 store 와 동일).
- 시드 cursor 는 primary shot id — 서버가 시드 자체를 자동 dedupe.

## 완료 항목

### 1. `frontend/src/stores/shotDetail.ts` 무한 스크롤 상태 + 액션
- 신규 state: `appendedShots: FeedPost[]` (메인 feed store 의 `FeedPost` 재사용 import), `nextLoading`, `nextEndReached`, `nextError`, `nextCursor: string | null`.
- 신규 action `loadNext()`:
  - guards: `nextLoading` / `nextEndReached` / 시드 부재 시 silent no-op.
  - 첫 호출은 primary shot id 를 cursor 로, 이후 호출은 서버가 내려준 `nextCursor` 사용.
  - 페이지 사이즈 상수 `NEXT_PAGE_SIZE = 3` (코드 주석으로 결정 근거 명시).
  - `hasMore=false` 또는 `nextCursor=null` → `nextEndReached=true`.
  - 네트워크 / 5xx 실패 → catch 블록에서 `nextEndReached=true` + `nextError` 기록 (재호출 spam 방지).
- `reset()` 에 새 state 5종 모두 초기화 추가.

### 2. `frontend/src/views/ShotDetailPage.vue` UI
- 신규 마크업: `<section class="sd-feed">` 하위에 `appendedShots` 를 `<article class="sd-feed-card">` 로 v-for. 13-feed-detail.html 의 `.post` 패턴 1:1 이식 (post-head + compare-wrap + 토글 + post-actions + caption).
- 각 카드는 자체 토글 상태 — `feedCardModes: Record<number, 'shot'|'guide'>` (keyed by shot id), 클릭 시 immutable 업데이트.
- 카드 하단: 신규 sentinel `<div ref="sentinelEl" data-testid="sd-infinite-sentinel">` + 로딩 인디케이터 (`더 불러오는 중…`) + 끝 도달 표시 (`마지막 인증샷이에요`).
- IntersectionObserver 셋업: `rootMargin: '300px 0px'` (뷰포트 진입 300px 전에 미리 트리거 → 자연스러운 끊김 없는 스크롤). shot 변경 시 watch 에서 재설정 (immediate=true + nextTick — DOM mount 후), `nextEndReached=true` 시 즉시 disconnect, `onUnmounted` 시 cleanup.
- testid 추가: `sd-feed`, `sd-feed-card`, `sd-feed-toggle`, `sd-infinite-sentinel`, `sd-infinite-loading`, `sd-infinite-end`.
- jsdom 안전: `window.IntersectionObserver` 부재 시 silent skip.
- 기존 primary shot 의 `compareMode`, 좋아요/저장/팔로우, 댓글 시트, 라우터 가드, 캐러셀 — 100% 보존.
- 신규 CSS: `.sd-feed`, `.sd-feed-card`, post-head/compare-wrap/post-actions/post-caption (13-feed-detail 톤 + scoped), `.sd-infinite-sentinel`, `.sd-infinite-status`.

### 3. 단위 테스트
- `src/stores/__tests__/shotDetail.spec.ts` — 신규 5 케이스 (총 11):
  - 첫 호출 cursor 시드 = primary shot id 검증 + URL/params 검증.
  - 후속 호출이 서버 issued nextCursor 사용 검증.
  - 빈 posts + hasMore=false → nextEndReached=true.
  - 엔드포인트 실패 → nextEndReached + nextError, throw 안 함.
  - guards (nextLoading / nextEndReached / 시드 부재) silent no-op.
  - 기존 reset 케이스에 무한 스크롤 state 5종 초기화 검증 추가.
- `src/views/__tests__/ShotDetailPage.spec.ts` — 신규 2 케이스 (총 19):
  - IntersectionObserver mock 으로 sentinel 진입 → loadNext 호출 → feed-card 렌더 검증 (caption + handle 텍스트 포함).
  - end-of-feed 상태에서 `[data-testid="sd-infinite-end"]` 노출 + "마지막" 카피 검증.

## 검증
- `npx vue-tsc --noEmit` 그린.
- `npm run test:unit` — 50 files / **527 tests** 통과 (이전 520 + 신규 7).
- `npm run build` 그린.
- `npm run lint` — 신규 위반 0건 (사전 3 error 그대로).
- **Dev 서버 헬스체크**:
  - `pkill -f vite` 선행 (task #13 lesson).
  - Vite v5.4.21 ready in 2142ms, 콘솔 에러/경고 0건.
  - `GET /shot/15` → HTTP 200 (954 bytes SPA shell).
  - `GET /src/views/ShotDetailPage.vue` → HTTP 200, 134 585 bytes (이전 task #13 후 101 770 → +33 KB, 무한 스크롤 마크업 / CSS / 핸들러 추가).
  - 토큰 검증: `appendedShots=5`, `loadNext=1`, `nextEndReached=6`, `sd-feed-card=2`, `sd-feed-toggle=1`, `sd-infinite-sentinel=2`, `sd-infinite-end=1`, `sd-infinite-loading=1` — 모두 정상 transform.

## 변경 파일
- (M) `frontend/src/stores/shotDetail.ts`
- (M) `frontend/src/stores/__tests__/shotDetail.spec.ts`
- (M) `frontend/src/views/ShotDetailPage.vue`
- (M) `frontend/src/views/__tests__/ShotDetailPage.spec.ts`
- (M) `_workspace/03_frontend_implementation.md`

---

# Task #16 — ShotDetailPage `.sd-top` 헤더 sticky 적용

## 완료 항목

### 템플릿 재구성 (sticky 작동을 위한 컨테이너 정리)
- 기존: `.sd-top` 이 `<ion-content>` 의 absolute-positioned 헤더, `.sd-scroll` 은 shot 로드 후에만 렌더되는 conditional 스크롤 컨테이너 — sticky 적용 불가능 (`.sd-top` 이 스크롤 컨테이너 밖).
- 신규: `.sd-scroll` 이 항상 렌더되는 outer wrapper 가 되고, 그 안에 `.sd-top` (sticky) + 상태별 placeholder/loaded 분기가 들어감.
- `data-testid="sd-loaded"` 는 새 inner wrapper `.sd-loaded` 로 이동 — 기존 spec 의 `.exists()` 단언 그대로 통과.

### CSS — sticky + 톤 변경
- `.sd-top`: `position: sticky; top: 0; z-index: 30;` + `padding: calc(8px + env(safe-area-inset-top)) 16px 8px;` (iOS 노치 대응).
- 배경: `rgba(255,255,255,0.85) + backdrop-filter: blur(14px) saturate(160%)` — 스크롤 시 콘텐츠가 비치지 않으면서 배경 미세하게 살짝 보이는 frosted glass.
- 하단 1px 흐린 보더 (rgba(15,23,42,0.06)) — 스크롤 영역과의 시각적 경계.
- `.ic-btn`: 기존 다크 원형(`rgba(15,23,42,0.55)`) → 13-feed-detail 톤의 `rounded square + var(--fr-bg-muted)` neutral chip — sticky bg 가 light 라 dark 컨트라스트 불필요.
- `.lbl-chip.l/r`: `top: calc(60px + env(safe-area-inset-top))` → `top: 12px` — sticky 헤더가 layout space 를 가져가서 photo 가 헤더 아래에 시작하므로 정상 offset 으로 충분.
- `.sd-scroll`: `height: 100%` 추가 (ion-content 안에서 외부 스크롤 자식이 명시적 높이를 가져야 자체 overflow 가 동작).

### z-index 충돌 검증
- `.sd-top z-index: 30`.
- CommentSheet — Ionic modal 패턴, Ionic 자체 오버레이 z-index (1000+) 사용.
- ScoreRevealOverlay — UploadPage 전용이라 ShotDetail 과 무관.
- 결론: 스티키 헤더는 모든 모달 아래로 명확히 정렬됨.

### 비즈니스 로직 보존
- 좋아요/저장/팔로우, 댓글 시트, 라우터 가드, 캐러셀, compare 토글, 무한 스크롤(#15), back/more 버튼 — 100% 보존.

## 검증
- `npx vue-tsc --noEmit` 그린.
- `npm run test:unit` — 50 files / **527 tests** 통과 (변경 없음).
- `npm run build` 그린.
- `npm run lint` — 신규 위반 0건 (사전 3 error 그대로).
- **Dev 서버 헬스체크** (`pkill -f vite` 선행):
  - Vite v5.4.21 ready in 2089ms, 콘솔 에러/경고 0건.
  - `GET /shot/15` → HTTP 200.
  - `GET /src/views/ShotDetailPage.vue` → HTTP 200, 138 928 bytes (이전 134 585 → +4 KB sticky 마크업/CSS).
  - 토큰 검증: `position: sticky` × 1, `sd-scroll` × 2, `sd-loaded` × 4 — 모두 정상.

## 변경 파일
- (M) `frontend/src/views/ShotDetailPage.vue`
- (M) `_workspace/03_frontend_implementation.md`

---

# Task #17 — 무한 스크롤 추가 카드 마크업을 primary shot과 동일하게

## 완료 항목

### 마크업 통일
- 기존 task #15 의 `.sd-feed-card` 는 13-feed-detail 의 `.post` 패턴(post-head + .compare-wrap + post-actions + post-caption) — primary shot 의 5-section 구조와 다른 visual.
- task #17 에서 추가 카드를 **primary 와 동일한 5-section 마크업** 으로 재작성:
  1. `<section class="compare" data-mode>` — 두 이미지 absolute 겹침 + lbl-chip + scene-meta + compare-toggle
  2. `<section class="sd-user">` — avatar + nickname/verified + place·date + 팔로우 버튼
  3. `<section class="sd-stats">` — 좋아요 / 댓글 / 저장 / 공유 4종
  4. `<section class="sd-caption">` — caption + date (FeedPost 는 tags 미보유 → 미렌더)
  5. `<button class="cmt-input-wrap">` — 댓글 작성 트리거
- primary 와 동일한 CSS 클래스를 그대로 사용 → 기존 `.compare`, `.lbl-chip`, `.scene-meta`, `.compare-toggle`, `.sd-user`, `.sd-stats`, `.sd-stat-btn`, `.sd-caption`, `.cmt-input-wrap` 룰이 그대로 적용. 별도 inner CSS 추가 거의 없음.

### 데이터 차이 처리 (FeedPost vs ShotDetail)
- 추가 카드는 `/api/feed` 응답의 `FeedPost` 사용 — 필드 이름 약간 다름:
  - `dramaSceneImageUrl` ↔ primary `sceneImageUrl`
  - `work.workEpisode` ↔ primary `work.episode`
  - `author.userId` ↔ primary `author.id`, `author.isMe` 부재 (서버 분기 안 함, 항상 다른 사용자)
  - tags / topComments / address 부재
- 템플릿에서 v-for 루프 내 직접 바인딩 — 어댑터 함수 없이 마크업이 명확.

### 인터랙션 정책 (재량)
- 좋아요/저장/팔로우/댓글 등 모든 액션 버튼: **read-only (`disabled`)**. 시각만 일치, 동작은 primary 만.
- 사용자가 추가 카드의 인증샷을 자세히 보려면 카드를 탭해 `/shot/<id>` 진입 — task description 에 명시된 흐름.
- 추후 인터랙티브로 확장 시 backend 와 협의 후 별도 task.
- 시각: `disabled` 버튼이 ghosted 처럼 보이지 않도록 `opacity:1 + cursor:default` override 추가.

### testid 충돌 회피
- 카드 내부 testid 부여 안 함 — 외곽 `[data-testid="sd-feed-card"]` 만. 기존 spec 의 `[data-testid="sd-like-btn"]` / `sd-save-btn` / `sd-author-action` / `sd-cmt-trigger` / `sd-compare-toggle` 등은 모두 primary 에만 존재.
- 회귀 테스트가 카드 내부를 검증할 땐 `card.find('section.compare')`, `card.find('.sd-stat-btn')` 등 카드별 스코프 셀렉터 사용 (신규 task #17 spec 참고).

### CSS 정리
- `.sd-feed-card .post-head/.post-actions/.post-caption/.compare-wrap/.compare-img/.compare-lbl-top/.compare-lbl-bot/.compare-toggle` 룰 모두 삭제. primary 의 동명 클래스 룰이 그대로 적용되어 중복 제거.
- 신규 추가: `.sd-feed-card .sd-user .nm:disabled / .follow:disabled / .sd-stat-btn:disabled / .cmt-input-wrap:disabled { cursor:default; opacity:1 }` — read-only 상태 시각 보정.

### 단위 테스트
- `frontend/src/views/__tests__/ShotDetailPage.spec.ts` 신규 1 케이스 (총 20):
  - `appended feed cards render the same 5-section structure as the primary shot (task #17)` — store 에 FeedPost 1개 push → 카드 1개 렌더 → 5 섹션(`section.compare`/`section.sd-user`/`section.sd-stats`/`section.sd-caption`/`button.cmt-input-wrap`) 존재 검증 + compare 두 이미지 src 검증 + scene-meta work info 검증 + sd-user nickname/verified/place 검증 + sd-stat-btn 4개 모두 disabled 검증 + sd-caption .body/.tag (tags 0개) + cmt-input-wrap disabled.

## 검증
- `npx vue-tsc --noEmit` 그린.
- `npm run test:unit` — 50 files / **528 tests** 통과 (이전 527 + 신규 1).
- `npm run build` 그린.
- `npm run lint` — 신규 위반 0건.
- **Dev 서버 헬스체크** (`pkill -f vite` 선행):
  - Vite v5.4.21 ready in 1880ms, 콘솔 클린.
  - `GET /shot/15` → HTTP 200.
  - `GET /src/views/ShotDetailPage.vue` → 150 214 bytes (이전 task #16 후 138 928 → +12 KB, 5-section 마크업 펼침 + 일부 CSS 삭제 상쇄).
  - 토큰 검증: `post-head`, `post-actions`, `post-caption` × 0 (모두 제거 확인) / `sd-user` × 5, `sd-stats` × 5, `sd-caption` × 4, `cmt-input-wrap` × 3, `sd-feed-card` × 3 — 정상.

## 변경 파일
- (M) `frontend/src/views/ShotDetailPage.vue`
- (M) `frontend/src/views/__tests__/ShotDetailPage.spec.ts`
- (M) `_workspace/03_frontend_implementation.md`

---

# Task #18 — 무한 스크롤 추가 카드의 좋아요/댓글/저장/팔로우 인터랙션 활성화

## 활성화된 인터랙션
- **좋아요**: 카드 하트 클릭 → optimistic 토글 + `POST /api/photos/:id/like` + 실패 rollback.
- **저장(북마크)**: 카드 북마크 클릭 → primary 와 동일 정책 (saved 면 `savedStore.toggleSave(placeId)`, unsaved 면 `uiStore.openCollectionPicker(placeId)`).
- **팔로우**: 작성자 팔로우 버튼 → optimistic 토글 + `POST /api/users/:userId/follow`. 같은 작성자의 다른 카드 (피드에 같은 사람이 여러 장 올렸을 때) 도 함께 flip + 실패 시 일괄 rollback.
- **댓글**: 카드 댓글 stat 또는 cmt-input-wrap 클릭 → CommentSheet 가 그 카드의 post id 로 열림.
- **닉네임 클릭**: `router.push('/user/<userId>')` → 작성자 프로필.
- 공유 버튼: `disabled` 유지 (primary 도 share endpoint 가 stub `showInfo` 라 동등).

## 구현 요약

### `frontend/src/stores/shotDetail.ts`
- 신규 action `toggleAppendedLike(postId)`:
  - optimistic flip on matching `appendedShots` entry — `liked`, `likeCount` 동시 갱신.
  - 성공 시 server response (`liked`, `likeCount`) 로 sync.
  - 실패 시 originalLiked + originalCount 로 정확히 복원.
  - 미로그인 시 `useUiStore().showLoginPrompt(...)` 후 early return.
- 신규 action `toggleAppendedFollow(userId)`:
  - 같은 userId 의 카드 모두에 optimistic flip 적용 (피드 내 한 작성자가 여러 카드를 가질 수 있음).
  - 성공 시 server response 로 sync, 실패 시 wasFollowing 으로 일괄 rollback.

### `frontend/src/views/ShotDetailPage.vue`
- 신규 ref `commentSheetPhotoId: number | null` — 시트가 어떤 post 의 댓글을 보여주는지 트래킹.
- `onOpenComments()` (primary) / `onOpenAppendedComments(post)` 둘 다 `commentSheetPhotoId` 를 set 후 시트 open.
- `onCommentCreated()`: 새 댓글 알림 시 `commentSheetPhotoId` 와 매치되는 post (primary 또는 appended) 의 `commentCount += 1`.
- 신규 핸들러 5종: `onToggleAppendedLike`, `onToggleAppendedSave`, `onToggleAppendedFollow`, `onOpenAppendedComments`, `onOpenAppendedAuthor`.
- 신규 helper `feedCardSaved(post)` — `savedStore.isSaved(post.place.id)` 로 클라이언트 store 의 single source 보장 (primary 와 동일 패턴).
- 카드 마크업: 이전 `disabled` 속성 모두 제거 + `@click` 핸들러 wired. 공유 버튼만 `disabled` 유지.
- `<CommentSheet :photo-id="commentSheetOpen ? commentSheetPhotoId : null">` 로 변경 — primary `shot.id` hardcode 제거.

### CSS
- 기존 read-only 룰 정리: `.sd-feed-card .sd-stat-btn:disabled { cursor: default; opacity: 1 }` 만 유지 (공유 버튼 전용).

## 단위 테스트

### `frontend/src/stores/__tests__/shotDetail.spec.ts` 신규 5 케이스 (총 16)
- toggleAppendedLike: POST URL + optimistic flip + likeCount 갱신 검증.
- toggleAppendedLike: 실패 rollback (liked / likeCount 둘 다 원복).
- toggleAppendedLike: unknown postId 시 silent no-op.
- toggleAppendedFollow: 같은 작성자의 카드 두 장 동시 flip + POST URL.
- toggleAppendedFollow: 실패 시 모든 매칭 카드 일괄 rollback.

### `frontend/src/views/__tests__/ShotDetailPage.spec.ts` 신규 5 케이스 (총 25)
- 좋아요 버튼 click → POST `/api/photos/:id/like` + appendedShots[idx] liked/likeCount 갱신.
- 저장 버튼 click (unsaved place) → `uiStore.openCollectionPicker(placeId)` 호출.
- 팔로우 버튼 click → POST `/api/users/:userId/follow` + author.following=true.
- cmt-input-wrap click → CommentSheet open + photo-id 가 primary 가 아닌 appended post id (76) 로 표시.
- 닉네임 click → `router.push('/user/<userId>')`.
- 기존 task #17 spec 갱신: 모든 stat 버튼 disabled → 좋아요/댓글/저장 enabled, 공유만 disabled.

## 검증
- `npx vue-tsc --noEmit` 그린.
- `npm run test:unit` — 50 files / **538 tests** 통과 (이전 528 + 신규 10).
- `npm run build` 그린.
- `npm run lint` — 신규 위반 0건.
- **Dev 헬스체크** (`pkill -f vite` 선행):
  - Vite v5.4.21 ready in 2137ms, 콘솔 클린.
  - `GET /shot/15` → HTTP 200.
  - `GET /src/views/ShotDetailPage.vue` → 155 973 bytes (이전 150 214 → +5.7 KB, 신규 핸들러 5종 + 댓글 시트 trakcing + helper).
  - 토큰 검증: `toggleAppendedLike/Follow` × 1 each (store 액션 setup expose), `onOpenAppendedComments` × 4, `onOpenAppendedAuthor` × 3, `onToggleAppendedSave` × 3, `feedCardSaved` × 4, `disabled` × 4 (공유 button).

## Pinia 반응성 노트 (개인 메모)
- 처음 follow rollback 테스트 작성 시 `{ ...post, id: 76 }` 로 두 카드를 push 했다가 `author` 객체가 두 카드 간에 공유되어 Pinia 의 deep proxy 가 mutation 을 unexpectedly 처리. 테스트는 pass→fail 사이를 오갔음.
- 해결: 테스트에서 `{ ...post, id: 76, author: { ...post.author } }` 로 author 도 사본 분리. production 데이터는 JSON 파싱 결과라 자동 분리되므로 무관.

## 변경 파일
- (M) `frontend/src/stores/shotDetail.ts`
- (M) `frontend/src/stores/__tests__/shotDetail.spec.ts`
- (M) `frontend/src/views/ShotDetailPage.vue`
- (M) `frontend/src/views/__tests__/ShotDetailPage.spec.ts`
- (M) `_workspace/03_frontend_implementation.md`

---

# Task #19 — RewardPage dead route/component/spec 제거 + ShotPlace.address 필드 제거

## 1. RewardPage 완전 제거 (audit High Risk 1)
- `frontend/src/router/index.ts` 의 `/reward/:placeId` 라우트 매핑 제거 (이전 라인 102~107). dynamic import 도 함께 사라져 RewardPage chunk 가 번들에서 자동 누락.
- `frontend/src/views/RewardPage.vue` 파일 삭제 (477 lines).
- `frontend/src/views/__tests__/RewardPage.spec.ts` 파일 삭제 (4 케이스).
- task #8/12 작업 시점에 "dead route 보존(옵션 C)" 결정했었으나, audit 검토 결과 안전하게 제거 결정 (UploadPage 가 인증완료까지 호스트, 외부 진입점 없음).

### `/reward/*` 도달 시 동작
- Vite dev/prod 모두 SPA fallback 으로 index.html (HTTP 200) 반환 — 클라이언트 라우터가 클라이언트 측에서 매칭.
- Vue router 에 catch-all 없음 → 매칭 실패 시 router-view 가 비어 사용자에게 빈 화면. 명시적 NotFoundPage 가 필요해지면 별도 task 로 catch-all redirect (`/:pathMatch(.*)*` → /home) 또는 NotFoundPage 컴포넌트 추가 가능. **현 task 스코프 외**.

## 2. ShotPlace.address 필드 제거 (audit Med Risk)
- `frontend/src/stores/shotDetail.ts` 의 `ShotPlace.address: string | null` 필드 제거 + "loc-card when present" docstring 삭제.
- task #13 에서 loc-card 마크업 제거 후 UI 어디에서도 사용 안 했음 (audit 확인). 백엔드 task #20 (PhotoDetailResponse 의 address 필드 제거) 와 동기화.
- 테스트 fixture 에서도 `address: '...'` 라인 제거: `frontend/src/views/__tests__/ShotDetailPage.spec.ts`, `frontend/src/stores/__tests__/shotDetail.spec.ts`.

## 검증
- `npx vue-tsc --noEmit` 그린.
- `npm run test:unit` — **49 files / 534 tests** 통과 (이전 50/538 → -1 file -4 tests, 정확히 RewardPage.spec.ts 누락분).
- `npm run build` 그린, dist 산출물에 `RewardPage-*.js` chunk 없음 (이전엔 별도 chunk 였음).
- `npm run lint` — 신규 위반 0건 (사전 3 error 그대로).
- **Dev 헬스체크** (`pkill -f vite` 선행):
  - Vite v5.4.21 ready.
  - `GET /shot/15` → 200 (정상).
  - `GET /reward/10` → 200 (Vite SPA fallback — index.html 반환, Vue router 가 클라이언트 매칭 실패).
  - 컴파일된 router/index.ts 에 `RewardPage` × 0, `/reward/` × 0 — 모두 제거 확인.

## 변경 파일
- (M) `frontend/src/router/index.ts` (라우트 + dynamic import 제거, 5 lines 삭제)
- (D) `frontend/src/views/RewardPage.vue` (477 lines 삭제)
- (D) `frontend/src/views/__tests__/RewardPage.spec.ts` (4 케이스 삭제)
- (M) `frontend/src/stores/shotDetail.ts` (address 필드 + docstring 삭제)
- (M) `frontend/src/views/__tests__/ShotDetailPage.spec.ts` (fixture address 라인 삭제)
- (M) `frontend/src/stores/__tests__/shotDetail.spec.ts` (fixture address 라인 삭제)
- (M) `_workspace/03_frontend_implementation.md`
