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
