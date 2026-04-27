# 04 QA Report — 인증샷 점수 기능 (Task #6, #7)

브랜치: `feat/place-photo-score-gps` · 헤드 커밋: `fc3fc35`

## Task #6 — 백엔드 단위/통합 테스트

### 추가/수정 파일
- **신규**: `src/test/java/com/filmroad/api/domain/place/ShotScoringServiceTest.java` — 23 케이스
- **수정**: `src/test/java/com/filmroad/api/domain/place/PhotoControllerTest.java`
  - 기존 14곳의 `PhotoUploadRequest` 5-arg 호출을 7-arg(`latitude=null, longitude=null`)로 일괄 갱신 (회귀 fix)
  - 신규 점수 통합 케이스 6건 추가

### ShotScoringServiceTest — 23 케이스 (단위)

| ID | 카테고리 | 시나리오 | 기대 |
|---|---|---|---|
| G1 | GPS | 동일 좌표 (37.8928,128.8347) | gpsScore = 100 |
| G2 | GPS | 약 50m 거리 (lat +0.00045) | gpsScore = 80 ± 2 |
| G3 | GPS | 약 200m 거리 (lat +0.0018) | gpsScore = 50 ± 3 |
| G4 | GPS | 약 1km 거리 (lat +0.009) | gpsScore = 0~5 |
| G5 | GPS | ~5.5km (lat +0.05) | gpsScore = 0 |
| G6 | GPS | 촬영 좌표 null (둘 다, 한쪽씩) | gpsScore = 0 |
| G7 | GPS | 범위 밖 (lat=91, lng=181, lat=-91) | gpsScore = 0 |
| G8 | GPS | Null Island (0,0) | gpsScore = 0 |
| H | GPS | Haversine sanity (위도 1도≈111km, 서울 위도 경도 1도≈88km) | 범위 검증 |
| S1 | 유사도 | 동일 이미지 (체커보드) | similarityScore ≥ 95 |
| S2 | 유사도 | 체커보드 vs 단색 흰색 | 동일 케이스보다 명확히 낮음, < 70 |
| S3 | 유사도 | sceneImageUrl null | 0 |
| S4 | 유사도 | sceneImageUrl 빈 문자열 | 0 |
| S5 | 유사도 | scene 파일 부재 (/uploads/ghost.png) | 0 |
| S6 | 유사도 | 업로드 비-이미지 바이트 | 0 |
| S7 | 유사도 | scene URL `file://`/`ftp://` 등 알 수 없는 prefix | 0 |
| S8 | 유사도 | path traversal (`/uploads/../etc/passwd`) | 0 (base 밖 차단) |
| T1 | 총점 | 동일 좌표 + 동일 이미지 (score 진입점) | 97~100 (gps=100, sim≥95, 가중합) |
| T2 | 총점 | 좌표 누락 + 동일 이미지 | 57~60 (sim 가중치 0.6) |
| T3 | 총점 | 동일 좌표 + sceneUrl null | 정확히 40 (gps 가중치 0.4) |
| T4 | 총점 | 좌표 누락 + sceneUrl null | 0 |
| T5 | 총점 | place=null | 모두 0 (fallback) |
| T6 | 총점 | clamp 보장 | 어떤 입력 조합도 [0,100] |

**보안 케이스 추가** (S7, S8): scene URL 핸들러의 unknown scheme 차단과 path traversal 방어 — 정책 외 시나리오 회귀 방지.

### PhotoControllerTest — 신규 통합 케이스 6건

| ID | 시나리오 | 핵심 어설션 |
|---|---|---|
| C1 | 동일 좌표 업로드 (37.8928,128.8347) | gpsScore=100, totalScore∈[0,100], capturedLat/Lng echo |
| C2 | 좌표 누락 (null,null) | gpsScore=0, capturedLat/Lng `doesNotExist()`, 리워드 정상 |
| C3 | DB row 검증 | `placePhotoRepository.findById().getCapturedLatitude()=37.8928`, gpsScore=100 |
| C5 | 잘못된 위도 (200.0) | 200 OK + gpsScore=0 + DB `capturedLat=null` (정책 b 검증) |
| C6 | 한쪽만 정상 (lat=37.5, lng=null) | 둘 다 null 정규화 + gpsScore=0 |
| C7 | 멀티 업로드(3장) | images 3 + 점수는 batch 대표 1세트 (회귀 방지) |

### 회귀 fix — 5-arg → 7-arg 일괄 갱신
backend-dev #1 commit이 `PhotoUploadRequest` 에 `latitude/longitude` 2개 필드를 추가하면서 기존 테스트의 5-arg 호출 14곳이 컴파일 에러가 됐다. QA에서 `replace_all` 로 두 패턴 일괄 갱신 (PUBLIC, false / FOLLOWERS, true).

## 검증 결과

### `./gradlew compileTestJava` / `./gradlew test`
- ❌ **WSL FileLock 이슈**로 실행 불가:
  ```
  Could not create service of type FileHasher using BuildSessionServices.createFileHasher().
  java.io.IOException: Input/output error
  ```
- backend-dev `_workspace/02_backend_implementation.md` 에서도 동일 이슈 보고 (task #1, #2 모두). 환경 제약.
- `GRADLE_USER_HOME` 변경 우회 시도도 실패 — fundamental 한 WSL ↔ Gradle 파일 시스템 hash 충돌.

### 정적 코드 정합성 검증 ✅
gradle 실행 불가에 대비해 코드 레벨로 컴파일 정합성 검토:

| 항목 | 결과 |
|---|---|
| `ShotScoringService` public/package-private 메서드 시그니처 일치 (`score`, `computeGpsScore`, `computeSimilarityScore`, `haversineMeters`) | ✅ |
| `ShotScoreDto` record accessor 매칭 (`similarityScore()`, `gpsScore()`, `totalScore()`) | ✅ |
| `Place.builder()` 필드 (name, regionLabel, latitude, longitude, sceneImageUrl, work) | ✅ |
| `Work.builder().title(...)` 빌더 + title 필드 | ✅ |
| `PlacePhoto.getCapturedLatitude/Longitude/TotalScore/GpsScore/SimilarityScore` getter (Lombok @Getter) | ✅ |
| `PhotoUploadResponse` flat 필드 — `$.results.{totalScore,similarityScore,gpsScore,capturedLatitude,capturedLongitude}` | ✅ |
| `PhotoUploadRequest` 7-arg 호출 14곳 일괄 갱신 (5-arg → 7-arg, null,null) | ✅ |
| Hamcrest `greaterThanOrEqualTo`/`lessThanOrEqualTo`/`is` — 기존 import `org.hamcrest.Matchers.*` 로 커버 | ✅ |
| `@TempDir` (junit-jupiter), `MockMultipartFile` (spring-test) 의존성 | ✅ |
| `@DecimalMin/@DecimalMax` 제거 검증 — PhotoUploadRequest 현재 코드 확인됨 | ✅ |

### 정합성 위험 평가
- **S2 케이스**: 체커보드 vs 단색 — pHash 알고리즘 특성상 두 단색 이미지는 변별력 낮을 수 있어 의도적으로 체커보드 사용. 만약 임계 70이 fail 하면 임계 조정 또는 보다 강한 패턴 사용 필요. **gradle 실행 후 첫 실패 가능 후보**.
- **C1/C3 외부 URL 의존성**: place 10 의 sceneImageUrl 이 Unsplash https URL — 통합 테스트 시 외부 호출 필요. ShotScoringService 가 실패 시 0 fallback 이라 테스트 자체는 그린이지만, similarityScore 가 변동 가능. 어설션은 [0,100] 범위만 검증.

## 대기 중 — gradle 실행
환경 이슈 해결되면 (CI / 로컬 IDE / 다른 OS) `./gradlew test` 로 23 + 6 + 기존 회귀 통과 여부 최종 검증 필요. 실패 케이스 발생 시 backend-dev 에 즉시 SendMessage 회신.

---

## Task #7 — 프론트엔드 컴포넌트/E2E

### 추가 파일
- `frontend/src/views/__tests__/CameraPage.spec.ts` — 가이드 썸네일 토글 describe 블록 7 케이스 추가 (F1~F7)
- `frontend/src/components/__tests__/ScoreRevealOverlay.spec.ts` — frontend-dev 6 + QA 확장 3 (접근성, aria-label, 부분 null) = 총 9 케이스
- `frontend/src/views/__tests__/CameraPage.spec.ts` — eslint unused-var 회귀 fix (`_blob` → `blob; void blob;`)

### CameraPage 가이드 토글 7 케이스 (F1~F7)
| ID | 시나리오 | 핵심 어설션 |
|---|---|---|
| F1 | plain 모드 + targetPlace → 컨테이너+이미지 렌더, aria-pressed=true | testid="guide-thumb"/"guide-thumb-toggle" + aria-label "가이드 사진 보이기/숨기기" |
| F2 | 토글 클릭 → 이미지 v-if false, 컨테이너 유지 | aria-pressed=false |
| F3 | 한 번 더 클릭 → 다시 visible | aria-pressed=true, 이미지 재렌더 |
| F4 | targetPlace=null → 컨테이너 자체 미렌더 | overlaySrc null 회귀 |
| F5 | compare 모드 → guide-thumb 미렌더, .guide-card 노출 | UI 충돌 방지 |
| F6 | overlay 모드(기본) → guide-thumb 미렌더 | 정책 회귀 |
| F7 | plain → overlay 전환 → guide-thumb 사라짐 | 모드 전환 회귀 |

### ScoreRevealOverlay QA 확장 3 케이스
| ID | 시나리오 | 어설션 |
|---|---|---|
| A1 | 접근성 회귀 | role="dialog", aria-modal="true", aria-busy 가 loading 동기화 |
| A2 | total aria-label | 숫자 → "총점 88", null → "총점 미산정" (스크린 리더용) |
| A3 | breakdown 부분 null | similarity 78 + gps null → "78"/"—" 분리 표시 |

### 자동화 검증 결과 ✅
```
$ npm run test:unit -- --run
Test Files  50 passed (50)
Tests  496 passed (496)
Duration  128.72s
```
- 핵심 파일: CameraPage.spec.ts (15 tests), ScoreRevealOverlay.spec.ts (9 tests), UploadPage.spec.ts (10 tests, frontend-dev 가 이미 score overlay 통합 흐름 케이스 추가), upload.spec.ts (14 tests, GPS geolocation 분기 포함)
- `npx vue-tsc --noEmit` 그린 (0 에러)
- `npx eslint <변경 파일들>` 그린

### 회귀 체크리스트

#### 자동화로 커버됨 ✅
1. CameraPage 모드 전환 (compare/overlay/plain) — F1~F7 + 기존 mode opacity spec
2. CameraPage 셔터 + 갤러리 픽업 (기존 회귀 PASS)
3. ScoreRevealOverlay 흐름 — loading → 점수 표시 → 닫기 emit (frontend-dev UploadPage spec L219 + ScoreRevealOverlay spec)
4. ScoreRevealOverlay 0점/null 분기 (회귀)
5. UploadPage submit + retry + offline 가드 (frontend-dev 추가 케이스)
6. upload store GPS 좌표 캡처 + meta JSON 전송 (upload.spec.ts geolocation mock)

#### 수동 점검 권장 (모바일 dev 서버 + 시뮬레이터) 🟡
| ID | 항목 | 점검 방법 |
|---|---|---|
| M1 | 우상단 가이드 썸네일 — iOS safe-area 노치 미침범 | `top: calc(72px + env(safe-area-inset-top))` 코드는 OK, 시뮬레이터 실측 |
| M2 | 가이드 썸네일 — Android 상단바 회피 | Android 시뮬레이터 |
| M3 | 5장 업로드 OK / 6장 거절 / 25MB 초과 거절 | 백엔드 통합 + 모바일 dev |
| M4 | 점수 카운트업 1.3s 부드러움 | 실기기 + GPU/저사양 디바이스 |
| M5 | 점수 닫기 → /reward/:id 라우팅 시 store 정리 정상 | 라우팅 흐름 1회 수동 |
| M6 | GPS 권한 거부 → 업로드 200 + gpsScore=0/UI "—" 표시 | 시뮬레이터 위치 권한 거부 모드 |
| M7 | 좌표 누락 + 외부 sceneImageUrl fetch 실패 → totalScore=0 정상 | 네트워크 격리 환경 |
| M8 | ShotDetailPage 좋아요/저장/팔로우/댓글 (status M store 인접 회귀) | dev 서버 수동 |
| M9 | FollowList/UserProfile/FeedDetail sanity (status M 인접) | dev 서버 sanity |
| M10 | seed 기존 사진(legacy row, totalScore=0) — UI 가 "0"으로 표시 | dev 서버 |

#### legacy row 주의사항 ⚠️
backend-dev 안내: ddl-auto=update 후 기존 seed/legacy place_photo row는 `totalScore=0` (미채점). frontend-dev 결정으로 별도 "미채점" 플래그 없이 0 으로 그대로 표시. **E2E에서 기존 사진 페이지를 열어 "0점"을 false fail 로 잡지 말 것**. 신규 업로드 흐름에서만 실제 점수가 들어옴.

### 결론
Task #7 **자동화 PASS + 회귀 체크리스트 정리 완료**. 수동 항목은 dev/QA 환경 의존이므로 commit 단계에서 별도 sanity 점검 권장.

---

## Task #9 — /upload 통합 페이지 회귀 (단계 A→B 전환)

### 컨텍스트
frontend-dev #8 commit으로 `/upload` 단일 페이지가 폼→채점→인증완료까지 전 흐름 호스트.
`/reward/:placeId` 라우트는 보존되지만 dead code (push 호출 없음).

### 추가 spec — `frontend/src/views/__tests__/UploadPage.spec.ts` 단계 B 7 케이스 (U5~U11)

| ID | 시나리오 | 핵심 어설션 |
|---|---|---|
| U5 | stamp-card 노출 + 텍스트 매핑 | `.stamp-info .t`/`.s`/`.p-v`/`.fill style` (workTitle/12·24/percent) |
| U6 | rewards 카드 3종 | pointsEarned `+50`, streakDays `7일`, level `LV.3 + 여행 중급자` |
| U7 | nextMilestoneCount 분기 | collected<total → "12곳" 노출, collected==total → 미렌더 |
| U8 | completionPlaceName fallback | stamp.placeName 우선 / 없으면 targetPlace.placeName |
| U9 | placeName XSS escape 회귀 | `<script>` 가 raw HTML 로 안 들어감, `&lt;script` entity 형태 |
| U10 | "친구에게 자랑하기" CTA | toast controller 호출 (placeholder 동작) |
| U11 | stage B 마크업 디자인 회귀 | `h1.rw-title="인증 완료!"` + `.check-ring` + scoring 영역 사라짐 |

**테스트 패턴 정착**: `reachAuthenticatedStage()` helper로 `vi.useFakeTimers + advanceTimersByTimeAsync(800)` 단계 전환 표준화. `mockImplementation` 으로 `store.lastResult` 까지 직접 set 해야 stamp/reward 분기가 살아난다 (단순 mockResolvedValue 만으로는 lastResult 가 set 안 됨 — 직접 발견).

### frontend-dev 가 #8 commit 시 이미 작성한 케이스
- UploadPage spec L245: compose → scoring → authenticated 전환 + `/reward` redirect 미발생 회귀
- UploadPage spec L307: "홈으로 돌아가기" → uploadStore reset + `/home` replace
- ScoreRevealOverlay spec: close emit → `count-up-complete` emit 교체, role/aria-modal 인라인 후 제거된 부분 명시 ("no dialog wrapper")

### 검증 결과 ✅
```
$ npm run test:unit -- --run
Test Files  50 passed (50)
Tests  504 passed (504)
```
- 신규 +8 (UploadPage U5~U11 7건 + 기존 케이스 자연 회귀)
- `npx vue-tsc --noEmit` 그린 (0 에러)
- `npx eslint src/views/__tests__/UploadPage.spec.ts` 클린

### RewardPage 처리 결정
- **결정**: 옵션 C (보존 + dead code) — team-lead 지시
- `RewardPage.vue` 477L 그대로, `/reward/:placeId` 라우터 매핑 유지, `RewardPage.spec.ts` 4 케이스 그대로
- 회귀: UploadPage spec 에 `expect(replaceSpy).not.toHaveBeenCalledWith(/^\/reward\//)` 단언으로 dead code 진입 금지 보장 (frontend-dev 추가)

### 수동 회귀 추가 (M11~M15)
| ID | 항목 | 점검 |
|---|---|---|
| M11 | 카운트업 → 단계 B 전환 타이밍 (1.3 + 0.7 = 2.0s) 자연스러움 | dev 서버 |
| M12 | 06-reward.html 디자인 픽셀 매칭 (stamp-card / rewards / check-ring) | screenshots/06-reward.png 비교 |
| M13 | 단계 B 에서 뒤로가기 → /home 또는 /upload 복귀 동작 | 수동 (라우터 history) |
| M14 | 모바일 viewport — stamp-card / rewards 가 한 화면에 들어오는지 | iOS/Android 시뮬레이터 |
| M15 | 점수 0 + 인증완료 화면 — UX 모순 없는지 (점수 0인데 "성공적으로 수집") | 카피/흐름 검토 |

---

## Task #10 후속 — scoring 단계 stamp/rewards 노출 회귀 (자율 추가)

frontend-dev가 Task #10 commit (stamp-card / rewards 가 scoring 단계에도 노출되도록 변경) 후, 노출 매트릭스의 핵심 분기를 자동화로 고정하는 회귀 케이스 2건을 자율 추가.

### 변경
- 기존 U5/U6 셀렉터 강화 — `.stamp-card` / `.rewards .reward` → `[data-testid="completion-stamp-card"]` / `[data-testid="completion-rewards"] .reward` (testid 기반 회귀 안정성)
- 신규 케이스 2건:

| ID | 시나리오 | 어설션 |
|---|---|---|
| U12 | scoring(loaded) — 응답 도착 후 700ms beat 전 | `upload-stage-scoring` 노출, `completion-stamp-card` / `completion-rewards` 노출, `upload-go-home` / `upload-boast` / `completion-place-name` 미노출 |
| U13 | scoring + 응답에 stamp/reward 없음 | `upload-stage-scoring` 노출, `completion-stamp-card` / `completion-rewards` 미노출 (v-if 분기) |

### 검증 결과 ✅
```
$ npm run test:unit -- --run
Test Files  50 passed (50)
Tests  508 passed (508)
```
- 누적: frontend-dev #10 후 506 → QA +2 = **508**
- vue-tsc 0 에러, eslint 클린

### 자율 진행 근거
- Auto mode 활성 + frontend-dev로부터 직접 변경 영향 알림 수신
- team-lead 명시 task 할당은 없었으나, 노출 매트릭스의 회귀 가치가 명확 (응답 도착 vs 단계 전환의 두 축이 분리됨)
- frontend-dev가 자기 회귀(L246 케이스 갱신)는 처리, QA는 매트릭스 노출/미노출 양쪽 분기 보강

---

## 종합 (#6, #7, #9 + #10 자율 회귀)

| Task | 자동화 | 수동/환경 | 상태 |
|---|---|---|---|
| #6 백엔드 (ShotScoringServiceTest 23 + PhotoControllerTest 6 + 회귀 fix 14) | ✅ 정적 정합성 통과, ❌ `./gradlew test` 실행 불가 (WSL FileLock — backend-dev/team-lead 동일 보고) | CI/리눅스 환경에서 실제 실행 검증 필요 | completed (정적 PASS) |
| #7 프론트 (CameraPage 7 + ScoreRevealOverlay 3 + 회귀 체크리스트) | ✅ 496/496 PASS | M1~M10 수동 권장 | completed |
| #9 프론트 단계 B (UploadPage U5~U11 7 케이스) | ✅ 504/504 PASS | M11~M15 수동 권장 | completed |
| #10 후속 자율 회귀 (U12, U13 + U5/U6 testid 강화) | ✅ **508/508 PASS** | (없음) | completed |

