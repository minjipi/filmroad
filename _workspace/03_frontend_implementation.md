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
