# Backend Implementation — feat/place-kakao-info

## 작업 범위
PlaceDetailPage 의 새 kakao-section 데이터를 위해 Kakao Local REST API 연동 추가.
- 장소 자체 메타데이터(주소/전화/카테고리/카카오맵 URL): 1:1 캐시 + 24h TTL
- 주변 맛집(FD6) / 카페(CE7): 매 요청 fresh, 캐시 안 함
- API 키 미설정/장애 시 200 + `available=false` 로 응답 (프론트가 섹션 숨김)

## 변경된 파일

### 신규 (production)
- `src/main/java/com/filmroad/api/integration/kakao/KakaoLocalProperties.java` — `@ConfigurationProperties("kakao")` record. `disabled-kakao` sentinel 처리.
- `src/main/java/com/filmroad/api/integration/kakao/KakaoLocalResult.java` — 카카오 API 응답을 keyword/category/coord2address 통합 정규화한 내부 record.
- `src/main/java/com/filmroad/api/integration/kakao/KakaoLocalClient.java` — Spring 6 RestClient 기반. `findPlace(name, lat, lng)` 키워드 → 0건이면 reverse-geocode 폴백, `findNearby(code, lat, lng, radius)` 카테고리 검색. 실패 시 빈 결과(예외 전파 X).
- `src/main/java/com/filmroad/api/domain/place/KakaoPlaceInfo.java` — Place 와 1:1 (`@MapsId`, place_id PK) 캐시 엔티티. BaseEntity 상속.
- `src/main/java/com/filmroad/api/domain/place/KakaoPlaceInfoRepository.java` — `findByPlaceId(Long)`.
- `src/main/java/com/filmroad/api/domain/place/KakaoPlaceInfoService.java` — `getOrFetch(placeId)`: 캐시 fresh 면 그대로, 아니면 외부 호출 + upsert. nearby 는 매 요청 두 카테고리 호출 후 거리순 정렬.
- `src/main/java/com/filmroad/api/domain/place/dto/KakaoNearbyDto.java` — 주변 항목 응답.
- `src/main/java/com/filmroad/api/domain/place/dto/PlaceKakaoInfoResponse.java` — `available` 플래그 포함 응답.

### 수정 (production)
- `src/main/java/com/filmroad/api/FilmroadApplication.java` — `@ConfigurationPropertiesScan` 추가로 `KakaoLocalProperties` 빈 등록.
- `src/main/java/com/filmroad/api/domain/place/PlaceController.java` — `GET /{id}/kakao-info` 엔드포인트 추가 (Operation/ApiResponses 메타).
- `src/main/java/com/filmroad/api/config/SecurityConfig.java` — `/api/places/*/kakao-info` GET 을 permitAll() 목록에 추가.
- `src/main/resources/application.yml` — `kakao.*` 설정 블록 추가.
- `src/main/resources/application-dev.yml` — 동일 블록 추가 (env 기반 override).
- `src/test/resources/application-test.yml` — `kakao.rest-api-key=disabled-kakao` 명시.
- `src/main/resources/data.sql` — `kakao_place_info` 시드 2건 (place_id=10, 14). dev 환경에서 키 없이도 캐시 데이터 보임.

### 신규 (테스트)
- `src/test/java/com/filmroad/api/domain/place/KakaoPlaceInfoServiceTest.java` — Mockito 단위 테스트 6 케이스.
  - placeId 없음 → `BaseException(PLACE_NOT_FOUND)`
  - 캐시 fresh → 외부 호출 X
  - 캐시 miss → save 호출 + 응답 매핑
  - 캐시 expired → 기존 행 update (save 안 부름, dirty checking)
  - 키 비활성 + 캐시 없음 → `available=false`
  - 키 비활성 + stale 캐시 → 캐시 데이터로 응답

### 수정 (테스트)
- `src/test/java/com/filmroad/api/domain/place/PlaceControllerTest.java` — 통합 테스트 3 케이스 추가.
  - `/api/places/10/kakao-info` 캐시 시드로 `available=true` 응답
  - `/api/places/12/kakao-info` 캐시 없음 + 키 비활성 → `available=false`
  - `/api/places/99999/kakao-info` 404

## API 계약 (frontend-dev 와 합의)

### Endpoint
```
GET /api/places/{id}/kakao-info
인증: 불필요 (permitAll)
```

### 응답 스키마 (BaseResponse 래핑)
```json
{
  "success": true,
  "code": 20000,
  "message": "요청에 성공하였습니다.",
  "results": {
    "roadAddress": "강원 강릉시 주문진읍 교항리 산51-2",
    "jibunAddress": "강원 강릉시 주문진읍 교항리 산51-2",
    "phone": "033-640-5420",
    "category": "여행 > 관광,명소 > 해변",
    "kakaoPlaceUrl": "https://place.map.kakao.com/8138648",
    "lastSyncedAt": "2026-04-26T12:00:00.000+00:00",
    "nearby": [
      {
        "name": "주문진해전어",
        "categoryGroupCode": "FD6",
        "categoryName": "음식점 > 한식 > 해물,생선",
        "distanceMeters": 120,
        "kakaoPlaceUrl": "https://place.map.kakao.com/...",
        "lat": 37.8927,
        "lng": 128.8350,
        "phone": "033-661-1234"
      }
    ],
    "available": true
  }
}
```

### available=false 시
```json
{
  "success": true,
  "code": 20000,
  "message": "요청에 성공하였습니다.",
  "results": {
    "roadAddress": null,
    "jibunAddress": null,
    "phone": null,
    "category": null,
    "kakaoPlaceUrl": null,
    "lastSyncedAt": null,
    "nearby": [],
    "available": false
  }
}
```
프론트엔드는 `available=false` 면 kakao-section 자체를 렌더링하지 않는다.

### 환경 변수
```
KAKAO_REST_API_KEY=<카카오 REST API 키>
```
미설정 시 `disabled-kakao` 으로 떨어져 외부 호출이 즉시 빈 결과 반환.

## 테스트 결과
- `./gradlew test` — 그린. 신규 9 케이스(6 unit + 3 integration) 포함 전체 통과.
- `./gradlew build` — BUILD SUCCESSFUL.

### curl 호출 예시
```bash
# dev 서버 (키 없이도 시드 캐시로 동작)
curl http://localhost:8080/api/places/10/kakao-info | jq

# 키 미설정 + 캐시 없음 → available=false
curl http://localhost:8080/api/places/12/kakao-info | jq

# 존재하지 않는 placeId → 404
curl -w '\nHTTP %{http_code}\n' http://localhost:8080/api/places/99999/kakao-info
```

## 비고 / 제약
- 카카오 API 가 영업시간/리뷰/메뉴는 안 줌 — 프론트는 "카카오맵에서 보기" CTA 로 우회 (응답 `kakaoPlaceUrl`).
- nearby 는 캐시 안 함. quota 보호는 캐시되는 장소 메타데이터 쪽에만 24h TTL 로 적용.
- 외부 호출 timeout 3s. 실패는 디버그 로그 + 빈 결과 — endpoint 가 500 으로 안 떨어진다.

---

# Backend Implementation — feat/place-photo-score-gps (Task #1)

브랜치: `feat/place-photo-score-gps` · 커밋: `fca1ab9`

## 작업 범위
인증샷 채점 시스템(가이드 사진 유사도 + 성지 GPS 근접도) 의 데이터 컬럼/DTO 토대 마련.
실제 점수 산출 로직은 후속 task #2 (점수 계산 서비스) 가 담당. 본 task 는 컬럼 + 입출력 통로만.

## 변경된 파일 (production)

### 수정
- `src/main/java/com/filmroad/api/domain/place/PlacePhoto.java`
  - 신규 컬럼 5개:
    - `total_score INT NOT NULL DEFAULT 0` (0~100)
    - `similarity_score INT NOT NULL DEFAULT 0` (0~100)
    - `gps_score INT NOT NULL DEFAULT 0` (0~100)
    - `captured_latitude DOUBLE NULL`
    - `captured_longitude DOUBLE NULL`
  - 헬퍼: `applyScores(int similarity, int gps, int total)`, `setCapturedCoordinates(Double lat, Double lng)`
- `src/main/java/com/filmroad/api/domain/place/dto/PhotoUploadRequest.java`
  - `Double latitude` (`@DecimalMin -90.0` / `@DecimalMax 90.0`, nullable)
  - `Double longitude` (`@DecimalMin -180.0` / `@DecimalMax 180.0`, nullable)
- `src/main/java/com/filmroad/api/domain/place/dto/PhotoUploadResponse.java`
  - `int totalScore / similarityScore / gpsScore`, `Double capturedLatitude / capturedLongitude` 노출
  - `of(post, stamp, reward)` 매퍼에 점수/좌표 매핑 5줄 추가
- `src/main/java/com/filmroad/api/domain/place/dto/PhotoDetailResponse.java`
  - 동일 5개 필드 노출
- `src/main/java/com/filmroad/api/domain/place/PhotoUploadService.java`
  - `PlacePhoto.builder()` 에 `.capturedLatitude(req.getLatitude()).capturedLongitude(req.getLongitude())` 2줄 추가
  - 점수 3종은 0(미채점) 으로 시작, 후속 task #2 의 채점 서비스가 `applyScores` 로 채워줄 자리
- `src/main/java/com/filmroad/api/domain/place/PhotoDetailService.java`
  - `PhotoDetailResponse.builder()` 에 점수 3종 + 좌표 2종 5줄 매핑 추가

## 스키마 변경 (DDL)
`spring.jpa.hibernate.ddl-auto: update` (application-dev.yml) 환경에서 부팅 시 Hibernate 가
`place_photo` 테이블에 5개 컬럼을 자동 추가. 기존 row 는 default 값(점수 0, 좌표 NULL) 으로 후방 호환.

운영(`update` 미사용) 환경에서는 다음 마이그레이션 SQL 실행:
```sql
ALTER TABLE place_photo
  ADD COLUMN total_score INT NOT NULL DEFAULT 0,
  ADD COLUMN similarity_score INT NOT NULL DEFAULT 0,
  ADD COLUMN gps_score INT NOT NULL DEFAULT 0,
  ADD COLUMN captured_latitude DOUBLE NULL,
  ADD COLUMN captured_longitude DOUBLE NULL;
```

## API 계약 (frontend-dev 와 합의)

### `POST /api/photos` 요청 (multipart/form-data, `meta` 파트 JSON)
기존 필드(`placeId`, `caption`, `tags`, `visibility`, `addToStampbook`) 유지 + 추가:
```json
{
  "placeId": 10,
  "caption": "...",
  "latitude": 37.8927,
  "longitude": 128.8350
}
```
- `latitude` / `longitude` 는 nullable. 권한 거부/획득 실패 시 미전송 가능.
- 범위 검증 실패 시 400.

### `POST /api/photos` 응답 / `GET /api/photos/{id}` 응답
공통으로 신규 5개 필드 추가:
```json
{
  "totalScore": 0,
  "similarityScore": 0,
  "gpsScore": 0,
  "capturedLatitude": 37.8927,
  "capturedLongitude": 128.8350
}
```
- 본 task 시점에서는 점수 3종은 항상 0 (채점 미수행). task #2 머지 후 실제 값.
- 기존 row 는 좌표 null + 점수 0.

## 테스트 결과
- 환경 이슈: WSL 에서 Gradle FileLock 이 IO error 로 실패 (`./gradlew compileJava` 가 데몬/싱글유즈 모두 동일하게 `Could not create service of type FileHasher`).
  → 빌드 환경 문제로 기존 테스트는 로컬 IDE / CI 에서 검증 필요.
- 코드 정합성 검토: 모든 변경은 기존 패턴(@Builder + Lombok @Getter, Bean Validation, 정적 팩토리) 그대로 따름.
  - `PlacePhoto.builder().capturedLatitude(...).capturedLongitude(...)` — Lombok @Builder 가 Double 필드 받아 정상 처리.
  - `PhotoUploadResponse.of(...)` 매퍼 5줄 추가 — 기존 builder 체이닝과 동형.

## 후속 task 영향
- task #2 (백엔드 채점 서비스): `PlacePhoto.applyScores(...)` 헬퍼 사용해 업로드 직후 점수 산출 → 저장.
  본 task 의 컬럼/헬퍼가 그 토대.
- task #4 (프론트 GPS 전송): `PhotoUploadRequest.latitude/longitude` 로 전송.
  iOS/Android 권한 거부 시 둘 다 빠져도 200 응답 보장.
- task #5 (프론트 채점 결과 표시): `PhotoUploadResponse.totalScore/similarityScore/gpsScore` 사용.
- task #6 (QA 백엔드 테스트): 본 commit 의 컬럼 + DTO 위에 task #2 채점 로직을 검증.

## 비고
- `PhotoUploadResponse` 매퍼에 점수/좌표 echo 매핑이 들어가지만, task #2 채점 서비스가 commit 전에
  `applyScores` 호출만 하면 응답에 자동 반영됨 (DTO 매핑은 entity 기준).

---

# Backend Implementation — Task #2 (ShotScoringService)

브랜치: `feat/place-photo-score-gps` · 커밋: `fc3fc35`

## 작업 범위
업로드된 인증샷을 (1) Place 등록 좌표와의 거리 (2) 가이드 사진(`Place.sceneImageUrl`) 과의
시각적 유사도 두 축으로 0~100 점 환산하여 PlacePhoto 에 저장.

## 변경된 파일

### 신규 (production)
- `src/main/java/com/filmroad/api/domain/place/ShotScoringService.java`
  - `score(Place, MultipartFile, Double lat, Double lng)` 진입점 → `ShotScoreDto` 반환.
  - GPS: Haversine 거리. 0m=100 / 50m=80 / 200m=50 / 1km+=0 의 구간별 선형 보간.
    좌표 null / 범위 밖이면 0 점.
  - 유사도: pHash. 32x32 grayscale → 자체 구현 2D DCT-II → 8x8 top-left → median 비트 해시(64비트)
    → Hamming distance 0=100 / 32+=0 선형 환산. JDK 만으로 (`java.awt.image.BufferedImage`,
    `javax.imageio.ImageIO`) 외부 의존성 없음.
  - 총점: `round(similarity * 0.6 + gps * 0.4)` clamp [0,100].
  - scene URL 로더: `/uploads/...` 로컬 경로와 `http(s)://...` 외부 URL 둘 다 지원.
    traversal 방어 (정규화 후 base 안에 머무는지 확인). HTTP timeout 3s connect / 5s read.
  - 디코딩/다운로드/IO 실패는 모두 내부에서 catch 후 0점 fallback — 예외 throw 안 함.
- `src/main/java/com/filmroad/api/domain/place/dto/ShotScoreDto.java`
  - `record ShotScoreDto(int similarityScore, int gpsScore, int totalScore)`.
  - `zero()` 정적 팩토리 — fallback 케이스용.

### 수정 (production)
- `src/main/java/com/filmroad/api/domain/place/PhotoUploadService.java`
  - `ShotScoringService` 생성자 주입.
  - 요청 좌표를 `sanitizeLatitude/Longitude` 로 정규화하여 [-90,90] / [-180,180] 범위 밖이면
    null. 한쪽만 있어도 둘 다 null (정책 b — UX 우선).
  - 첫 파일을 batch 대표로 `shotScoringService.score(...)` 호출 → `post.applyScores(...)` 적용.
  - `RuntimeException` 안전망 — 채점 실패는 warn 로그 + 0점 fallback, 업로드 흐름 유지.
- `src/main/java/com/filmroad/api/domain/place/dto/PhotoUploadRequest.java`
  - `@DecimalMin/@DecimalMax` 제거 — strict bean validation 으로 400 거부 대신 서비스 단
    정규화 + `gpsScore=0` 으로 처리하기로 결정 (정책 b).

## 알고리즘 결정 — 백엔드 재량으로 확정

| 항목 | 값 | 근거 |
|---|---|---|
| GPS 환산 곡선 | 0m=100, 50m=80, 200m=50, 1km=0 (구간 선형) | 일반 GPS 정확도 ~10m, 도보 1분 거리(50m) 까지 우대 |
| 유사도 알고리즘 | pHash (32x32 DCT 후 8x8 비트 해시) | 회전/평행이동에 강하고 외부 의존성 없음. 컬러 히스토그램은 같은 색상의 다른 장면을 못 거름 |
| Hamming → 점수 | 0=100, 32+=0 선형 | 32비트(50%) 차이부터는 random 수준이라 점수 0 처리 |
| 가중치 | sim 0.6 + gps 0.4 | similarity 가 "성지 인증" 본질적 신호. GPS 는 디바이스 흔들림 영향 큼 |
| 잘못된 좌표 | null 정규화 → gps=0, 업로드는 통과 | 정책 b. 업로드 자체 실패로 만들지 않는 UX 우선 |

## 외부 의존성 / 빌드 변경
**없음**. `build.gradle` 무수정. JDK 표준 라이브러리만 사용.

## 테스트 결과
- 환경 이슈로 `./gradlew` 가 WSL FileLock 으로 실패하는 상태 그대로 — 로컬 IDE / CI 에서
  검증 필요. 코드는 기존 `PhotoUploadService` 트랜잭션 흐름과 동일 패턴.
- 자체 검토:
  - `ShotScoreDto` record 의 accessor `.similarityScore() / .gpsScore() / .totalScore()` —
    `PlacePhoto.applyScores(int, int, int)` 시그니처와 정확히 매칭.
  - `MultipartFile.getInputStream()` 은 호출마다 fresh stream — 검증 단계의 `readNBytes(12)`
    이후에도 ImageIO 디코딩 정상 동작.
  - DCT N=32 → ~1M ops 로 부담 없음.
- task #6 (QA) 가 다음 케이스로 검증 예정:
  1. 좌표 0m → gpsScore=100
  2. 좌표 50m → gpsScore=80, 200m → 50, 1km → 0
  3. 좌표 위도 91.0 / null → gpsScore=0, 업로드 200
  4. 동일 이미지 업로드 → similarityScore≈100
  5. scene URL 누락 → similarityScore=0
  6. totalScore = round(sim*0.6 + gps*0.4)

## 후속 영향
- frontend-dev (task #5): 업로드 응답의 `totalScore / similarityScore / gpsScore` 가 이제
  실제 점수로 들어옴. 0 인 경우는 (a) 미채점 row(이전 데이터) (b) 좌표 누락 + scene 디코딩 실패
  의 두 케이스 — UI 에서 "채점 미수행" 표시 vs "0점" 표시 분기 필요시 응답에 별도 플래그 추가
  요청 가능.

---

# Backend Implementation — Task #14 (ShotDetailPage 무한 스크롤)

브랜치: `feat/shot-infinite-scroll` · 커밋: `eaf7af1`

## 결정 — 신규 엔드포인트 불필요, `GET /api/feed` 재사용

기존 `GET /api/feed?tab=RECENT&cursor=:id&limit=:n` 이 ShotDetailPage 무한 스크롤 요건을
정확히 충족함을 분석으로 확인. 신규 엔드포인트 / 신규 컨트롤러 추가 안 함.

| 요건 | 기존 엔드포인트 동작 |
|---|---|
| 커서 기반 페이지네이션 | `cursor` 파라미터 → `WHERE p.id < :cursor` |
| 시작 shot 자동 제외 | strict less 조건으로 cursor 자체 제외 |
| 최신순 정렬 | `ORDER BY p.id DESC` |
| visibility 필터 | PUBLIC + 본인 + FOLLOWERS 팔로우 적용 |
| 응답 형태 | `FeedResponse { posts: FeedPostDto[], hasMore, nextCursor }` |
| 작품/장소/작가 메타 | `FeedPostDto` 에 모두 포함 (place, work, author, like/comment count, sceneCompare) |

## 변경된 파일

### 수정 (테스트만)
- `src/test/java/com/filmroad/api/domain/feed/FeedControllerTest.java` — 통합 테스트 2 케이스 추가
  - **G1**: `cursor=175 + limit=5` → 응답에 id=175 자체 없음, 모든 shot 의 id < 175, hasMore/nextCursor 노출
  - **G2**: `cursor=2 + limit=20` (끝 도달) → `hasMore=false`, `nextCursor=null`

production 코드 무수정.

## API 가이드 (frontend-dev 용)
```
GET /api/feed?tab=RECENT&cursor={startShotId}&limit=10
인증: 선택 (쿠키 ATOKEN 있으면 viewer 기준 like/follow 반영)
```
응답:
```json
{
  "results": {
    "posts": [
      { "id": 174, "imageUrl": "...", "place": {...}, "work": {...}, "author": {...},
        "likeCount": 12, "commentCount": 3, "liked": false, "saved": false,
        "sceneCompare": true, "dramaSceneImageUrl": "...", "createdAt": "..." }
    ],
    "hasMore": true,
    "nextCursor": 174,
    "recommendedUsers": null
  }
}
```
- ShotDetailPage 진입 시 `cursor=현재 shotId` 로 첫 호출.
- 응답의 `nextCursor` 를 다음 호출의 `cursor` 로 사용.
- `hasMore=false` 면 더 이상 호출하지 않음.

## 비고
- `FeedPostDto` 가 `PhotoDetailResponse` 만큼 풀 정보(예: tags, topComments) 는 안 가짐.
  ShotDetailPage 의 "다음 카드" 가 미리보기 형태이면 충분. 매 카드에서 정확한 디테일이
  필요하면 카드 탭 시 `GET /api/photos/{id}` 를 호출하는 흐름으로.

---

# Backend Implementation — Task #20 (Audit Med Risk 2: address 노출 제거)

브랜치: `chore/photo-detail-remove-address` · 커밋: `0624bc0`

## 작업 범위
ShotDetail 응답에서 노출되던 `place.address` 필드를 응답 DTO 에서 제거. Place 엔티티의
`address` 컬럼 자체는 다른 도메인 사용 여지가 있어 그대로 보존 (응답 노출만 차단).

## 변경된 파일
- `src/main/java/com/filmroad/api/domain/place/dto/PhotoDetailPlaceDto.java`
  - `private String address;` 필드 제거
  - `from(Place)` 정적 팩토리에서 `.address(place.getAddress())` 매핑 1줄 제거
  - 코멘트로 제거 사유(Audit Med Risk 2번) 명시

production 코드 외 변경 없음.

## 회귀 위험 점검 (이전 사고 학습 적용)
- `PhotoDetailPlaceDto` 는 `@Builder` 만 (no `@AllArgsConstructor`) → 위치형 호출처 0
- `grep "new PhotoDetailPlaceDto\|PhotoDetailPlaceDto.builder\|PhotoDetailPlaceDto.from"`:
  - production 호출처 1곳: `PhotoDetailService.java:99` `.place(PhotoDetailPlaceDto.from(place))` — 시그니처 변경 없음
  - DTO 내부 builder 호출 1곳 (정적 팩토리 자체)
- `grep "place.address\|\"address\""` in `src/test/`: 0건 → 테스트 단언 갱신 불필요
- 다른 응답 DTO 에 `address` 노출 없음 (`FeedPostDto / FeedPlaceDto / GalleryPlaceHeaderDto / KakaoPlaceInfo` 등)
  → 본 변경은 ShotDetail 응답 한정으로 깨끗하게 격리

## frontend-dev 영향
task #19 가 ShotPlace 타입의 `address` 필드 + 화면 표시 부분을 동기 제거. 백엔드는 응답에서
필드가 사라질 뿐(JSON 키 자체 누락), 기존 응답 사용 코드는 컴파일/런타임 에러 없음 (TypeScript
`address?: string` 옵셔널이거나 destructure 시 undefined).

## API 응답 변경
Before:
```json
"place": {
  "id": 12,
  "name": "...",
  "regionLabel": "...",
  "address": "강원 강릉시 ...",
  "latitude": 37.89,
  "longitude": 128.83
}
```
After:
```json
"place": {
  "id": 12,
  "name": "...",
  "regionLabel": "...",
  "latitude": 37.89,
  "longitude": 128.83
}
```

## 빌드
WSL Gradle FileLock 환경 그대로. 변경은 단순 필드/매핑 1줄 제거이며 호출처 시그니처
변경 없음 → 컴파일/테스트 회귀 위험 0. CI / 로컬 IDE 검증.

---

# Backend Implementation — Task #28 (한국관광공사 API 프록시)

브랜치: `feat/nearby-restaurants` · 커밋: `61ff982` (16 files, +994 / -2)

## 작업 범위
PlaceDetailPage 의 "주변 맛집" 섹션을 위해 한국관광공사 KorService2 의 `locationBasedList2`
API 를 백엔드에서 프록시. KakaoSection 과 동일하게 외부 API 키 미설정/장애 시에도 200 +
빈 리스트로 응답 (프론트가 섹션을 자연스럽게 처리).

## 새 패키지 — `integration/koreatourism/`
- `KoreaTourismProperties` (record, `@ConfigurationProperties("korea-tourism")`) — `disabled-korea-tourism` sentinel 패턴
- `KoreaTourismClient` — RestClient 기반, `locationBasedList2` 호출. 고정 파라미터 + 동적 좌표/시군구. timeout 3s.
- `KoreaTourismItem` (record) — 외부 응답 정규화 record (item 한 개)
- `RegionCode` (record) — `lDongRegnCd / lDongSignguCd` 한 쌍
- `RegionCodeLookup` — 부팅 시 `data/koreaTourism-region-codes-raw.json` (한국관광공사 ldongCode2 raw 응답 그대로 264개) 로드.
  - 정확 매칭 (광역+시군구 정규화 문자열) + 토큰 매칭 (광역/시군구 양쪽이 input 에 등장) fallback
  - 매핑 미스 시 좌표만으로 호출 (radius=200km 라 보조 필터 누락도 동작)

## 새 도메인 산출물 — `domain/place/`
- `NearbyRestaurantService` — placeId → Place 조회 (없으면 PLACE_NOT_FOUND 404) → RegionCode lookup → 외부 호출 → DTO 매핑
- `dto/NearbyRestaurantsResponse` (래퍼) + `dto/NearbyRestaurantItem` (평탄 항목)
- `PlaceController.GET /api/places/{id}/nearby-restaurants` — Operation/ApiResponses 메타

## API 응답 형태 (frontend-dev 가이드)
```
GET /api/places/{id}/nearby-restaurants
인증: 불필요 (permitAll)
```
```json
{
  "results": {
    "items": [
      {
        "contentId": "C-1234",
        "title": "주문진해전어",
        "addr1": "강원 강릉시 주문진읍 ...",
        "distance": 120,
        "tel": "033-661-1234",
        "imageUrl": "https://image.example.com/abc.jpg",
        "lat": 37.8927,
        "lng": 128.8350
      }
    ]
  }
}
```
- 외부 API 의 `mapX/mapY` 는 백엔드에서 `lng/lat` 로 의미 있는 이름으로 평탄화
- 키 미설정/장애/응답 비어있음 → `items: []` (200, 빈 리스트)
- 존재하지 않는 placeId → 404 PLACE_NOT_FOUND

## 설정 / 보안
- `application.yml` + `application-test.yml`: `korea-tourism.*` 블록 추가. 서비스키는 `KOREA_TOURISM_KEY` 환경변수에서 주입, 누락 시 sentinel.
- `SecurityConfig`: `/api/places/*/nearby-restaurants` GET permitAll
- `FilmroadApplication`: `@ConfigurationPropertiesScan basePackageClasses` 에 `KoreaTourismProperties` 추가
- **서비스키 하드코딩 0** (grep 검증 완료) — 환경변수 only

## 테스트
- `NearbyRestaurantServiceTest` (Mockito, 5 케이스):
  1. unknown placeId → BaseException, 외부 호출 없음
  2. RegionCode hit → client 에 RegionCode 그대로 전달
  3. RegionCode miss → client 에 null 전달 (좌표만)
  4. 외부 빈 결과 → response.items=[]
  5. 외부 정상 결과 → KoreaTourismItem → NearbyRestaurantItem 매핑 (mapX→lng, mapY→lat)
- `PlaceControllerTest` 통합 2 케이스:
  1. `/api/places/10/nearby-restaurants`: disabled key (test profile) → 200 + items=[]
  2. `/api/places/99999/nearby-restaurants`: 404

## 회귀 점검 (이전 사고 학습)
- 기존 코드 시그니처 변경 0 — `PlaceController` 에 DI 필드 + 라우트 메서드 추가만
- 새 DTO 는 `@Builder` + 정적 팩토리 패턴 (`@AllArgsConstructor` 회피) → 위치형 호출처 위험 차단
- 기존 DTO/엔티티 무수정 — 컴파일 회귀 가능성 0

## 비고
- 캐싱: 본 commit 에선 적용 안 함. PlaceDetailPage 트래픽 패턴 + 한국관광공사 quota 정책 확인 후 후속 task 로 추가 가능 (KakaoPlaceInfo 의 `lastSyncedAt + ttl` 패턴 적용 가능).
- 매핑 JSON 은 한국관광공사 `ldongCode2` raw 응답 형태 그대로 보관 — 데이터 갱신 시 API 한 번 호출해 파일 교체로 끝.

---

# Backend Implementation — feat/place-scene-images (task #33)

## 작업 범위
`Place.scene_image_url` 단일 컬럼 + `Place.work_episode/scene_timestamp/scene_description` 평면 메타 3 종을
`place_scene_image` 자식 테이블 (1:N) 로 분리. 한 place 가 여러 씬을 가질 수 있는 데이터 모델 확립.
모델 패턴은 기존 `PlaceCoverImage` (cascade ALL + orphanRemoval + @OrderBy("imageOrderIndex ASC")) 그대로.

## 변경된 파일

### 신규 (production)
- `src/main/java/com/filmroad/api/domain/place/PlaceSceneImage.java` — 자식 엔티티 (`place_id, image_url, image_order_index, work_episode, scene_timestamp, scene_description`). image_url NOT NULL, 메타 3종 nullable. `attachToPlace` package-private 양방향 헬퍼.
- `src/main/java/com/filmroad/api/domain/place/dto/PlaceSceneDto.java` — 응답 DTO. `id/imageUrl/workEpisode/sceneTimestamp/sceneDescription/orderIndex` + `from(PlaceSceneImage)` 팩토리.

### 수정 (production - entity / 헬퍼)
- `src/main/java/com/filmroad/api/domain/place/Place.java`
  - 컬럼 4종 (`sceneImageUrl/workEpisode/sceneTimestamp/sceneDescription`) 모두 제거
  - `@OneToMany sceneImages` 추가 (cascade ALL + orphanRemoval + LAZY + OrderBy)
  - `addSceneImage(...)` 양방향 헬퍼
  - `getPrimarySceneImageUrl/getPrimaryWorkEpisode/getPrimarySceneTimestamp/getPrimarySceneDescription` 4개 폴백 getter — 요약 DTO 평면 필드 채우는 용도

### 수정 (production - 상세 DTO 3종, 평면 → `scenes: List<PlaceSceneDto>`)
- `src/main/java/com/filmroad/api/domain/place/dto/PlaceFullDto.java` — 4 평면 필드 제거, `scenes` 추가
- `src/main/java/com/filmroad/api/domain/place/dto/PhotoDetailResponse.java` — `sceneImageUrls` 제거, `scenes` 추가
- `src/main/java/com/filmroad/api/domain/work/dto/WorkSpotDto.java` — 평면 3 필드 제거, `scenes` 추가

### 수정 (production - 요약 DTO 콜사이트, 평면 유지하되 primary fallback)
- `src/main/java/com/filmroad/api/domain/feed/FeedService.java` → FeedWorkDto.workEpisode/sceneTimestamp = primary
- `src/main/java/com/filmroad/api/domain/place/dto/PhotoDetailWorkDto.java` → episode/sceneTimestamp = primary
- `src/main/java/com/filmroad/api/domain/place/dto/RelatedPlaceDto.java` → workEpisode = primary
- `src/main/java/com/filmroad/api/domain/place/dto/PhotoUploadResponse.java` → workEpisode = primary
- `src/main/java/com/filmroad/api/domain/place/GalleryService.java` → GalleryPlaceHeaderDto.workEpisode = primary
- `src/main/java/com/filmroad/api/domain/saved/SavedService.java` → CollectionItemDto.workEpisode = `formatWorkEpisode(primaryEp, primaryTs)`

### 수정 (production - 서비스)
- `src/main/java/com/filmroad/api/domain/place/PhotoDetailService.java` — `scenes` 매핑
- `src/main/java/com/filmroad/api/domain/work/WorkDetailService.java` — `scenes` 매핑
- `src/main/java/com/filmroad/api/domain/place/ShotScoringService.java` — **모든 sceneImage 순회 → max(similarity)**.
  pHash 비용 (32x32 DCT) 은 외부 다운로드 시간 대비 미미 → 가산 부담 없음. 빈 컬렉션이면 0.
- `src/main/java/com/filmroad/api/domain/place/dto/ShotScoreDto.java` — javadoc primary 표기 갱신

### 수정 (production - 마이그레이션 / seed)
- `src/main/java/com/filmroad/api/config/LegacyPhotoSchemaMigration.java`
  - 4 컬럼 (scene_image_url + work_episode + scene_timestamp + scene_description) 한 번에 자식 행으로 카피 후 모두 drop
  - `information_schema.columns` 사전 체크로 컬럼 부재 시 SQL 예외 자체를 회피 (catch 만으로는 트랜잭션이 rollback-only 마킹돼 ApplicationContext 부팅 실패하던 문제)
  - fresh DB 자동 skip
- `src/main/resources/data.sql`
  - `UPDATE place SET work_episode/scene_timestamp/scene_description/scene_image_url` 8건 모두 제거
  - `INSERT INTO place_scene_image` 8 행을 4 메타 모두 채우도록 재작성
  - **place 10/13/14 에 order=1 멀티 씬 행 3건 추가** (id 9~11) — carousel UI 시각 검증용
  - 컬럼 drop 은 LegacyPhotoSchemaMigration 이 카피 후 처리하므로 data.sql 에서는 미리 drop 안 함 (dev DB 데이터 손실 방지)

### 수정 (테스트)
- `src/test/java/com/filmroad/api/domain/place/PlaceControllerTest.java` — `place.workEpisode/sceneTimestamp` 평면 jsonPath → `place.scenes` 컬렉션 확인 + `scenes[0].workEpisode/sceneTimestamp/imageUrl/orderIndex` 어서션
- `src/test/java/com/filmroad/api/domain/place/ShotScoringServiceTest.java` — `Place.builder().sceneImageUrl(url)` 빌더 → `place.addSceneImage(PlaceSceneImage.builder()...)` 헬퍼 사용. null 인 경우 컬렉션 비워둠

## API 계약 (frontend-dev 와 합의)

### 상세 DTO 3종: 평면 필드 4 제거 → `scenes: PlaceSceneDto[]`
1. `GET /api/places/{id}` (PlaceFullDto)
   - 삭제: `workEpisode`, `sceneTimestamp`, `sceneDescription`, `sceneImageUrls`
   - 추가: `scenes: PlaceSceneDto[]`
2. `GET /api/photos/{id}` (PhotoDetailResponse)
   - 삭제: `sceneImageUrls`
   - 추가: `scenes: PlaceSceneDto[]`
3. `GET /api/works/{id}` 의 spots[] (WorkSpotDto)
   - 삭제: `workEpisode`, `sceneTimestamp`, `sceneDescription`
   - 추가: `scenes: PlaceSceneDto[]`

### 신규 PlaceSceneDto shape
```ts
type PlaceSceneDto = {
  id: number
  imageUrl: string
  workEpisode: string | null
  sceneTimestamp: string | null
  sceneDescription: string | null
  orderIndex: number   // 0 = 대표(primary)
}
```

### 요약 DTO (변경 없음 — 백엔드가 primary 폴백)
- `FeedWorkDto.workEpisode/sceneTimestamp`
- `PhotoDetailWorkDto.episode/sceneTimestamp`
- `RelatedPlaceDto.workEpisode`
- `CollectionItemDto.workEpisode` ("5회 00:31:02" 합성)
- `GalleryPlaceHeaderDto.workEpisode`
- `PhotoUploadResponse.workEpisode`
- `FeedPostDto.dramaSceneImageUrl` (단일 string, 피드 카드 1장 비교)

## 마이그레이션 안전성
- 부팅 순서: Hibernate ddl-auto → data.sql → CommandLineRunner(LegacyPhotoSchemaMigration)
- **fresh DB**: 새 entity 로 schema 생성, `place.scene_*` 컬럼 자체가 없음. data.sql 도 `INSERT INTO place_scene_image` 만 사용. CommandLineRunner 는 information_schema 체크 후 skip.
- **기존 dev DB**: ddl-auto=update 가 `scene_*` 컬럼 보존. data.sql 의 INSERT IGNORE 는 자식 테이블에 새 행 추가. CommandLineRunner 가 (1) `NOT EXISTS` 가드로 자식 행 없는 place 만 카피 (2) 4 컬럼 모두 drop.
- 카피 트리거 키: `image_url IS NOT NULL AND <> ''`. 메타만 있고 이미지 없는 historical row 는 새 모델로 표현 불가하므로 drop 시 손실 — 시드/실서비스 모두 4종이 항상 같이 들어와서 영향 없다고 판단.

## 테스트
- `./gradlew compileJava compileTestJava` → BUILD SUCCESSFUL
- `./gradlew test` → BUILD SUCCESSFUL
  - **206 tests / 0 failures / 0 ignored** (실행 18.6s, 빌드 2m 6s)
- 핵심 회귀 점검:
  - `PlaceControllerTest`: scenes 컬렉션 노출 확인
  - `SavedControllerTest`: `visitedPlacesList[0].workEpisode == "5회 00:31:02"` 그대로 그린 (place 14 order=0 시드)
  - `ShotScoringServiceTest`: 51 케이스 그린 (null/empty/single scene 모두)
  - `PhotoControllerTest`: 업로드 → similarity/total/gps 응답 그린 (1:N 모델 + max similarity 로직)

## 의사결정 메모
1. **상세 vs 요약 DTO 분리**: 상세 3 DTO 만 `scenes` 노출, 요약 6 DTO 는 평면 + primary 폴백. 카드/리스트 UI 가 1장 메타만 쓰니 프론트 수정 최소화.
2. **ShotScoringService max-similarity**: 같은 place 의 모든 씬 후보 중 best score 채택. 사용자가 어떤 씬을 재현했는지 알 수 없어 최선의 매칭 1건 기준이 자연스러움.
3. **마이그레이션 트랜잭션 폴루션 회피**: `try { native query } catch (...)` 만으로는 부족. JPA 트랜잭션이 rollback-only 마킹돼 commit 시점에 `UnexpectedRollbackException` → ApplicationContext 부팅 실패. information_schema 사전 체크로 예외 자체를 차단.
4. **메타-only row 손실 감수**: 기존 데이터 모두 4종이 함께 들어오는 패턴. image_url 없이 메타만 있는 historical row 는 사실상 없음. drop 으로 손실 허용.
5. **commit 보류**: 프론트 작업 끝나면 합께 한 commit 으로 — team-lead 지시.

---

# Task #1 — Add regionLabel + address to ContentSpotDto (feat/trip-route-frontend)

## 작업 범위
- `/api/contents/{id}` 의 `spots[]` 항목에 `regionLabel` (전체 행정구역 라벨)과 `address` (도로명/지번 주소) 두 필드 추가.
- 기존 `regionShort` 는 유지 (ContentDetailPage 칩 표기 영향 없도록).
- 프론트 trip route store가 이 두 필드를 사용해 지도 마커/리스트에 노출 예정.

## 변경된 파일
- `src/main/java/com/filmroad/api/domain/content/dto/ContentSpotDto.java`
  - `regionLabel`, `address` 필드 추가 (둘 다 `String`).
- `src/main/java/com/filmroad/api/domain/content/ContentDetailService.java`
  - `getContent` 의 spot 빌더에 `.regionLabel(p.getRegionLabel())`, `.address(p.getAddress())` 매핑 추가.

## 영향도
- **Place 엔티티 변경 없음** — `regionLabel`/`address` 모두 기존 컬럼이라 DDL/마이그레이션 불필요.
- **응답 호환성** — 추가 필드만 들어가므로 기존 클라이언트 무영향. ContentDetailPage 가 사용하는 `regionShort` 는 그대로 유지.
- **다른 도메인** — `ContentSpotDto` 사용처 grep 결과 ContentDetailService / ContentDetailResponse 외 없음.

## 테스트
- `./gradlew build` (test 포함) → **BUILD SUCCESSFUL** (3m 54s, 모든 테스트 통과)
  - 빌드 환경: WSL `/mnt/c` 에서 file lock I/O 에러로 `~/.gradle` 캐시 사용 불가 → `GRADLE_USER_HOME=/tmp/filmroad-gradle`, `--project-cache-dir=/tmp/filmroad-project-cache` 로 우회.
- 회귀 영향 없음: `ContentDetailService` 만 변경, 기존 spot 필드/순서는 모두 유지.

## 프론트엔드 영향
- frontend-developer (Task #2) 가 trip route store 를 실 API 로 교체할 때 `spots[i].regionLabel`, `spots[i].address` 활용 가능.
- 기존 `regionShort` 는 ContentDetailPage 가 그대로 사용 — 변경 없음.

---

# Task #8 — Kakao Mobility directions proxy (feat/trip-route-frontend)

## 작업 범위
- 카카오 모빌리티 `POST /v1/waypoints/directions` 를 백엔드에서 프록시.
- 이유: REST API 키(`KAKAO_REST_API_KEY`) 클라이언트 노출 금지. 기존 `KakaoLocalClient` 와 같은 키 + `KakaoAK` 헤더 패턴 그대로 차용.
- 외부 키 미설정/장애 시에도 200 + `available=false`, 빈 path → 프론트가 polyline 없이 폴백.

## 변경된 파일

### 신규 (production)
- `src/main/java/com/filmroad/api/integration/kakao/KakaoMobilityClient.java`
  - `getDirections(LatLng origin, LatLng destination, List<LatLng> waypoints) → Optional<MobilityRoute>`.
  - 요청 body: `{origin: {x: lng, y: lat}, destination: {...}, waypoints: [{name: "wp{i}", x, y}], priority: "RECOMMEND", car_fuel: "GASOLINE", car_hipass: false, alternatives: false, road_details: false, summary: true}`.
  - 응답 `routes[0].sections[].roads[].vertexes` flat array `[x,y,x,y,...]` → `List<LatLng(lat, lng)`).
  - `routes[0].summary.distance/duration` 추출.
  - 키 sentinel/빈 키/4xx/5xx/타임아웃/JSON 실패 → `Optional.empty()` + `log.debug`.
  - `result_code != 0` (경로 못 찾음) → empty.
  - `LatLng`, `MobilityRoute` 내부 record 노출 (서비스에서 변환용).
- `src/main/java/com/filmroad/api/integration/kakao/KakaoIntegrationConfig.java`
  - `kakaoMobilityRestClient` `@Bean` — baseUrl/timeout/Authorization 헤더 사전 주입한 `RestClient` 빈 정의.
  - 클라이언트가 직접 `RestClient.Builder.requestFactory()` 를 덮어쓰지 않게 함 → 테스트 `MockRestServiceServer` mock factory 가 깨지지 않음.
- `src/main/java/com/filmroad/api/domain/route/RouteController.java`
  - `POST /api/route/directions` — `BaseResponse<DirectionsResponse>`. `@Operation`/`@ApiResponses` Swagger anno.
- `src/main/java/com/filmroad/api/domain/route/RouteService.java`
  - `KakaoMobilityClient` 호출 + DTO 변환. empty 면 `DirectionsResponse.unavailable()`.
- `src/main/java/com/filmroad/api/domain/route/dto/LatLngDto.java`
  - `lat` `[-90, 90]`, `lng` `[-180, 180]` Bean Validation, `@NotNull`.
- `src/main/java/com/filmroad/api/domain/route/dto/DirectionsRequest.java`
  - `@NotNull` origin/destination, `@Valid` 중첩, waypoints `@Size(max = 30)`, null OK.
- `src/main/java/com/filmroad/api/domain/route/dto/DirectionsResponse.java`
  - `available`, `path`, `distanceMeters`, `durationSec` + `unavailable()` 정적 팩토리.

### 수정 (production)
- `src/main/java/com/filmroad/api/integration/kakao/KakaoLocalProperties.java`
  - `Mobility(baseUrl, timeoutMs)` 중첩 record 추가. record 시그니처에 세 번째 인자.
- `src/main/java/com/filmroad/api/config/SecurityConfig.java`
  - `POST /api/route/directions` permitAll (비로그인도 코스 그리기 가능).
- `src/main/resources/application.yml`, `src/main/resources/application-dev.yml`
  - `kakao.mobility.base-url=https://apis-navi.kakaomobility.com`, `kakao.mobility.timeout-ms=5000` 추가.
- `src/test/resources/application-test.yml`
  - 같은 mobility 블록 추가.

### 신규 (테스트)
- `src/test/java/com/filmroad/api/integration/kakao/KakaoMobilityClientTest.java` (6 cases)
  - 키 sentinel → 외부 호출 없이 empty
  - 정상 응답 → vertexes 두 개씩 묶어 4-pt path + summary 추출
  - 빈 vertexes/summary → empty
  - `result_code != 0` → empty
  - 외부 5xx → 예외 삼키고 empty
  - origin/destination null → empty
- `src/test/java/com/filmroad/api/domain/route/RouteControllerTest.java` (6 cases)
  - happy → `available=true` + path/distance/duration
  - client empty → `available=false` + 빈 path
  - waypoints 생략 OK
  - origin lat 91 → 400, 외부 호출 없음
  - destination lng -181 → 400
  - origin null → 400

### 수정 (테스트)
- `src/test/java/com/filmroad/api/domain/place/KakaoPlaceInfoServiceTest.java`
  - `new KakaoLocalProperties(...)` 호출에 `Mobility(...)` 인자 추가 (record 시그니처 변경 반영).

## 프론트 contract
```http
POST /api/route/directions
Content-Type: application/json

{
  "origin":      {"lat": 37.57, "lng": 126.98},
  "destination": {"lat": 37.58, "lng": 126.99},
  "waypoints":   [{"lat": 37.575, "lng": 126.985}]
}

→ 200
{
  "success": true,
  "code": 20000,
  "message": "요청에 성공하였습니다.",
  "results": {
    "available": true,
    "path": [{"lat": ..., "lng": ...}, ...],
    "distanceMeters": 38500,
    "durationSec": 5400
  }
}
```
- 키 미설정/외부 장애 → `available=false`, `path: []`, `distanceMeters: 0`, `durationSec: 0`.
- 좌표 범위 위반 / origin null / waypoints 30개 초과 → 400 `BaseResponse.error(REQUEST_ERROR)`.

## 마이그레이션 안전성
- 스키마 변경 없음 (외부 API 프록시).
- `KakaoLocalProperties` record 시그니처에 세 번째 인자(`Mobility`) 추가 — 직접 `new KakaoLocalProperties(...)` 호출하는 코드만 영향. 프로덕션 코드는 `@ConfigurationProperties` 바인딩이라 영향 없음. 테스트 한 곳만 수정.

## 테스트
- `GRADLE_USER_HOME=/tmp/filmroad-gradle ./gradlew --no-daemon --project-cache-dir=/tmp/filmroad-project-cache build` → **BUILD SUCCESSFUL**
  - 236 tests / 0 failures / 0 errors
  - KakaoMobilityClientTest 6/6, RouteControllerTest 6/6
  - 기존 230 케이스 영향 없음

## 의사결정 메모
1. **RestClient 를 @Bean 으로 분리한 이유**: 클라이언트 클래스가 직접 `RestClient.Builder.requestFactory()` 를 호출하면, 테스트의 `MockRestServiceServer.bindTo(builder)` 가 설치한 mock factory 를 덮어써 mock 이 무시됨. 빈으로 분리하면 (a) 프로덕션은 timeout/factory 적용된 RestClient 주입, (b) 테스트는 MockRestServiceServer 바인딩한 RestClient 를 직접 생성자로 주입. 양쪽 모두 깨끗하게 분리.
2. **KakaoLocalProperties 확장 vs 별도 properties 분리**: 같은 REST 키를 공유하므로 같은 prefix(`kakao.*`) 아래 두는 게 자연스러움. 별도 빈으로 가면 키 환경변수도 두 곳에서 읽어야 해 운영 부담. 단점은 record 시그니처 변경으로 테스트 1곳 수정 필요했으나 `@ConfigurationProperties` 바인딩은 영향 없음.
3. **available=false fallback**: 키 미설정/외부 장애 시 500 던지지 않고 200 + 빈 응답. KakaoLocalClient/`/api/places/*/kakao-info` 와 동일 정책 — 프론트가 polyline 없이 자연스러운 폴백 가능.
4. **waypoints null 허용**: 프론트가 origin↔destination 직선 경로만 필요할 때 비워서 보낼 수 있음. 서비스에서 `Collections.emptyList()` 로 정규화.
5. **30개 상한**: 카카오 모빌리티는 5개까지 권장이지만 트립 코스 최대 한도 + 안전 마진. 프론트 trip route 시나리오에서 spot 수가 그 이상 되면 sectional 호출로 분할해야 함 — 현재 task 범위 밖.
6. **commit 보류**: 프론트 task #9 끝나면 묶음 commit (team-lead 지시).

---

# Task #10 — Route init + save/load CRUD (feat/trip-route-frontend)

## 작업 범위
- `domain/route/` 에 사용자 트립 코스 도메인 추가: `Route` + `RoutePlace` 엔티티, 6개 엔드포인트.
- 동일 RouteController 에 task #8 의 `/directions` 와 함께 보관.
- 인증 정책: `init` 만 permitAll, 나머지는 본인 가드.

## 변경된 파일

### 신규 (production)
- `src/main/java/com/filmroad/api/domain/route/Route.java`
  - `id, user (FK NOT NULL LAZY), content (FK nullable LAZY), name, startTime VARCHAR(5), places OneToMany cascade ALL + orphanRemoval`.
  - `replacePlaces(List)` 헬퍼: `places.clear()` 후 양방향 연결로 재구성. orphanRemoval 로 기존 RoutePlace 자동 cascade 삭제.
  - `updateMeta(name, startTime, content)` 헬퍼.
  - 인덱스: `idx_route_user_updated (user_id, UPDATE_DATE)` — `findByUserIdOrderByUpdatedAtDesc` 최적화.
- `src/main/java/com/filmroad/api/domain/route/RoutePlace.java`
  - `id, route (FK), place (FK LAZY), orderIndex, durationMin (default 60), note TEXT`.
  - 유니크 제약: `(route_id, order_index)` → 동일 코스 내 순서 중복 차단.
- `src/main/java/com/filmroad/api/domain/route/RouteRepository.java`
  - `findByUserIdOrderByUpdatedAtDesc(userId)` — `@EntityGraph({content, places, places.place})`.
  - `findById(id)` 오버라이드 — 같은 그래프 + `user`. `places.place.coverImages/sceneImages` 는 List 라 **MultipleBagFetchException** 회피하기 위해 그래프에서 빠짐 → Service `@Transactional` 안에서 lazy 로 해결.
- `src/main/java/com/filmroad/api/domain/route/RouteCrudService.java`
  - `initFromContent(contentId)` — 비로그인 OK. Place ASC + suggestedName=`{title} 코스`, suggestedStartTime=`09:00`, durationMin=60.
  - `createRoute(req)`, `getRoute(id)`, `listMyRoutes()`, `updateRoute(id, req)`, `deleteRoute(id)`.
  - 본인 가드: 미존재 → ROUTE_NOT_FOUND(404), 비소유 → ROUTE_FORBIDDEN(403).
  - items 검증: 비어있지 않음(@NotEmpty), placeId 존재 확인(`findAllById` 결과 size 비교), orderIndex `0..n-1` 연속(중복/누락/음수/n초과 모두 거부) → ROUTE_INVALID_ITEMS(400).
  - 트랜잭션: 읽기 `readOnly = true`, 쓰기 기본.
- `src/main/java/com/filmroad/api/domain/route/RouteController.java` (task #8 컨트롤러에 6 엔드포인트 추가)
  - `GET /api/route/init?contentId=` (permitAll)
  - `POST /api/route` (auth)
  - `GET /api/route/me` (auth)
  - `GET /api/route/{id}` (auth, 본인만)
  - `PUT /api/route/{id}` (auth, 본인만)
  - `DELETE /api/route/{id}` (auth, 본인만)
  - 각각 `@Operation` + `@ApiResponses` Swagger 메타.
- `src/main/java/com/filmroad/api/domain/route/dto/RouteInitContentDto.java`
- `src/main/java/com/filmroad/api/domain/route/dto/RouteInitPlaceDto.java` (`durationMin=60` 기본)
- `src/main/java/com/filmroad/api/domain/route/dto/RouteInitResponse.java`
- `src/main/java/com/filmroad/api/domain/route/dto/RouteItemRequest.java` (Bean Validation)
- `src/main/java/com/filmroad/api/domain/route/dto/RouteCreateRequest.java` (Bean Validation: `@NotBlank name`, `@Pattern(HH:mm) startTime`, `@NotEmpty @Size(max=30) items`)
- `src/main/java/com/filmroad/api/domain/route/dto/SavedRouteItemDto.java`
- `src/main/java/com/filmroad/api/domain/route/dto/RouteResponse.java`
- `src/main/java/com/filmroad/api/domain/route/dto/RouteSummaryDto.java`

### 수정 (production)
- `src/main/java/com/filmroad/api/common/model/BaseResponseStatus.java`
  - 추가: `ROUTE_NOT_FOUND(40100)`, `ROUTE_FORBIDDEN(40101)`, `ROUTE_INVALID_ITEMS(30100)`.
- `src/main/java/com/filmroad/api/common/exception/GlobalExceptionHandler.java`
  - `ROUTE_NOT_FOUND` → 404, `ROUTE_FORBIDDEN` → 403 매핑 추가.
- `src/main/java/com/filmroad/api/config/SecurityConfig.java`
  - `/api/route/init` GET permitAll, `/api/route/**` authenticated. `/api/route/directions` 는 task #8 에서 이미 permitAll.
  - 매처 순서: directions → init → 나머지 authenticated. permit 매처가 먼저라 우선 매치.

### 신규 (테스트)
- `src/test/java/com/filmroad/api/domain/route/RouteCrudServiceTest.java` (15 cases)
  - init: 응답 빌드 / 미존재 contentId
  - create: happy / contentId 없는 자유 코스 / orderIndex 비연속 / 중복 / 미존재 placeId
  - get: 본인 / 타 유저 → ROUTE_FORBIDDEN / 미존재 → ROUTE_NOT_FOUND
  - listMyRoutes: SummaryDto 매핑
  - update: 본인 (메타 + items 통째 교체) / 타 유저 → ROUTE_FORBIDDEN
  - delete: 본인 / 타 유저
- `src/test/java/com/filmroad/api/domain/route/RouteCrudControllerTest.java` (14 cases)
  - init: 비로그인 OK / 미존재 contentId 404
  - POST: 미인증 401 / happy → id + GET 본인 200 / items 빈 400 / startTime "9:00" 400 / orderIndex 비연속 400(code=30100)
  - GET: 타 유저 403(code=40101) / 미존재 404(code=40100)
  - GET /me: 내 코스 목록
  - PUT: 본인 → items 통째 교체 / 타 유저 403
  - DELETE: 본인 → 200 + GET 404 / 타 유저 403 + 코스 살아있음

## 프론트 contract
```http
GET /api/route/init?contentId=5
→ 200
{ "results": {
    "content": {"id":5,"title":"…","posterUrl":"…|null"},
    "suggestedName": "… 코스",
    "suggestedStartTime": "09:00",
    "places": [{ "placeId","name","regionLabel","address","latitude","longitude",
                 "coverImageUrl","sceneImageUrl","durationMin":60,"rating" }, …]
  }
}

POST /api/route   (auth)
{ "name":"…", "startTime":"09:00", "contentId":5|null,
  "items":[{"placeId":10,"orderIndex":0,"durationMin":60,"note":"…|null"}, …] }
→ 200 { "results": { "id": 42 } }

GET  /api/route/me              (auth)  → 200 { "results": [RouteSummaryDto, …] }
GET  /api/route/{id}             (auth, owner)  → 200 { "results": RouteResponse }
PUT  /api/route/{id}             (auth, owner, body=Create 와 동일)  → 200 { "results": RouteResponse }
DELETE /api/route/{id}           (auth, owner)  → 200 { "results": null }
```
- 미인증 → 401 BaseResponse INVALID_JWT
- 비소유 → 403 ROUTE_FORBIDDEN(code=40101)
- 미존재 → 404 ROUTE_NOT_FOUND(code=40100)
- items 비/orderIndex 비연속 → 400 ROUTE_INVALID_ITEMS(code=30100)
- 형식 위반(startTime 패턴/items 빈/placeId null/coord 범위) → 400 REQUEST_ERROR(code=30001)

## 마이그레이션 안전성
- 신규 테이블 `route`, `route_place` 만 추가. 기존 데이터 영향 없음.
- dev: `ddl-auto=update` 가 부팅 시 두 테이블을 자동 생성 (인덱스/유니크 포함).
- test: `ddl-auto=create-drop` + `data.sql` 환경에서 동일하게 생성됨 (테스트 통과로 확인).
- 시드 INSERT 추가 안 함 — 사용자 생성 데이터라 빈 상태가 자연스러움.

## 테스트
- `GRADLE_USER_HOME=/tmp/filmroad-gradle ./gradlew --no-daemon --project-cache-dir=/tmp/filmroad-project-cache build` → **BUILD SUCCESSFUL** (2m 43s)
- 265 tests / 0 failures / 0 errors (이전 236 → 신규 29: RouteCrudServiceTest 15 + RouteCrudControllerTest 14)
- 회귀: 기존 250+건 모두 그린.
- Swagger UI 확인 항목: `/api/route/init`, `/api/route` (POST), `/api/route/me`, `/api/route/{id}` (GET/PUT/DELETE), `/api/route/directions` 6개 노출.

## 의사결정 메모
1. **EntityGraph 에서 coverImages/sceneImages 제외**: `Place.coverImages`, `Place.sceneImages` 가 모두 `List` 라 두 컬렉션을 동시에 fetch 하면 Hibernate `MultipleBagFetchException`. `Route.places` 와도 동시에 묶이면 같은 예외. → 그래프는 `places, places.place` 까지만, URL 들은 Service `@Transactional` 안의 lazy 로 풀음. 단건 detail 은 최대 30 items × 2 collection = 60 lazy 쿼리이지만 1회 호출이라 허용.
2. **RouteCrudService 분리**: task #8 의 `RouteService` 가 카카오 directions 만 담당하므로, CRUD 는 별도 service 로 분리해 책임을 좁혔다. 컨트롤러는 양쪽 다 주입.
3. **orderIndex 검증 in-memory**: DB 유니크 제약 `(route_id, order_index)` 가 있긴 하지만, 비즈니스 시맨틱(`0..n-1` 연속)을 사용자에게 친절한 에러로 돌려주려면 in-memory 검증이 필요. boolean 배열로 O(n).
4. **items.size() == 0 → 400 vs 정상**: 코스의 정의상 0개는 의미 없음. `@NotEmpty` 로 컨트롤러 boundary 에서 거부.
5. **content 의 nullable**: 자유 코스(콘텐츠 무관) 허용. 프론트가 init 안 거치고 직접 만들 수 있도록.
6. **404 vs 403 구분**: 타 유저 코스를 "404 로 숨기는" 보안적 장점도 있으나, 프론트 UX 가 "삭제됐어요" 와 "권한 없어요" 를 다르게 표시할 수 있도록 정직한 403 으로 응답. 사용자가 자기 ID 외로 코스 ID 를 brute-force 하는 시나리오는 데모 단계에서 우려 낮음.
7. **commit 보류**: 프론트 task #11 까지 끝나면 묶음 commit (team-lead 지시).

---

# Task #12 — Fix: KakaoMobility `summary:true` suppresses polyline (feat/trip-route-frontend)

## 증상
`/api/route/directions` 응답에 `path: []` 인데 `distanceMeters / durationSec` 만 정상값.

## 원인
카카오 모빌리티 사양상 요청 body 의 `summary` 파라미터는:
- `false` (기본): summary + sections + roads + vertexes 전체 응답
- `true`: summary 만 응답 — sections 가 통째로 빠짐

task #8 구현에서 `body.put("summary", true)` 로 둔 것이 잘못. summary 만 받게 되어 vertexes 가 누락 → `parseRoute` 에서 path 가 빈 채 `(distance, duration)` 만 채워져 응답.

## 변경된 파일
- `src/main/java/com/filmroad/api/integration/kakao/KakaoMobilityClient.java`
  - `body.put("summary", true)` → `body.put("summary", false)` + 사양 코멘트.

## 테스트
- `./gradlew build` (WSL 우회) → BUILD SUCCESSFUL (3m 35s)
- 265 tests / 0 failures / 0 errors. KakaoMobilityClientTest 의 정상 응답 mock 이 sections/roads/vertexes 를 포함하고 있어 그대로 그린 (요청 body 의 summary 값과 무관하게 mock 응답을 그대로 파싱).

## 검증 (manual)
- 백엔드 재기동 후:
  ```
  curl -X POST http://localhost:8080/api/route/directions \
    -H "Content-Type: application/json" \
    -d '{"origin":{"lat":37.394,"lng":127.110},"destination":{"lat":37.402,"lng":127.108},"waypoints":[{"lat":37.396,"lng":127.113}]}'
  ```
  응답 `results.path` 가 수십~수백 개 `{lat, lng}` 좌표쌍으로 채워지면 정상. distance/duration 도 동일하게 채워져야 함.

## 의사결정
- 라인 자체 제거(=false default 의존)도 가능했지만, 의도를 명시하기 위해 `false` 로 두고 카카오 사양 코멘트 첨부. 동일 실수 재발 방지.

---

# Task #16 — Expose `sections` (per-leg path) in directions response

## 작업 범위
프론트가 leg(section) 별로 polyline 을 perpendicular pixel offset 으로 시각 분리할 수 있도록, 카카오 모빌리티 응답의 sections 단위를 그대로 백엔드 응답에 노출. 기존 평탄화된 `path` 도 그대로 유지(단순 polyline 용).

## 변경된 파일

### 수정 (production)
- `src/main/java/com/filmroad/api/integration/kakao/KakaoMobilityClient.java`
  - `MobilityRoute` record 시그니처: `(path, distanceMeters, durationSec)` → `(path, sections, distanceMeters, durationSec)`. `sections` = `List<List<LatLng>>`.
  - `parseRoute`: 각 카카오 section 마다 별도 `sectionPath` 를 만들어 roads 의 vertexes 를 누적, 비어있지 않으면 `sectionsOut` 에 push 하고 동시에 flat `path` 에도 addAll. 결과적으로 `path == sections.flatten()`.
- `src/main/java/com/filmroad/api/domain/route/dto/DirectionsResponse.java`
  - `sections: List<List<LatLngDto>>` 필드 + Swagger 메타.
  - `unavailable()` 팩토리에서 `sections: List.of()` 추가.
- `src/main/java/com/filmroad/api/domain/route/RouteService.java`
  - 응답 빌더에 `route.sections()` → `List<List<LatLngDto>>` 매핑 추가.

### 수정 (테스트)
- `src/test/java/com/filmroad/api/integration/kakao/KakaoMobilityClientTest.java`
  - 정상 응답 mock 을 2개 section 으로 변경 (첫 section 두 road / 두 번째 한 road). path 7개, sections 2개(4+3) 검증.
- `src/test/java/com/filmroad/api/domain/route/RouteControllerTest.java`
  - happy path: `MobilityRoute` 생성 시 sections 인자 추가, 응답에서 `results.sections` shape (2 leg, 각 leg 2 좌표) + 첫/마지막 좌표 검증.
  - client empty: `results.sections.length() == 0` 검증 추가.

## 프론트 contract (변경)
```json
{ "results": {
    "available": true,
    "path": [{"lat":..,"lng":..}, ...],
    "sections": [
      [{"lat":..,"lng":..}, ...],   // leg 0: origin → wp0
      [{"lat":..,"lng":..}, ...],   // leg k: wp(k-1) → wp(k)
      ...                            // 마지막 leg: 마지막 wp → destination
    ],
    "distanceMeters": ...,
    "durationSec": ...
  }
}
```
- `path` 는 `sections.flatten()` 과 동일 — 단순 polyline 그릴 때 그대로 사용.
- `sections.length === waypoints.length + 1` (waypoints 가 비어있으면 1).
- `available=false` 면 `path: []`, `sections: []`.

## 테스트
- `./gradlew build` (WSL 우회) → BUILD SUCCESSFUL (4m 43s)
- 265 tests / 0 failures / 0 errors. KakaoMobilityClientTest / RouteControllerTest 의 신규 sections 검증 모두 그린.

## 의사결정
1. **path + sections 둘 다 유지**: sections 만 노출하면 단순 polyline 그릴 때 프론트가 평탄화 코드를 매번 작성해야 하므로 path 를 함께 제공. 데이터 중복은 있으나 directions 응답은 단발성이라 부담 적음.
2. **section 단위 = 카카오의 section 그대로**: 카카오 모빌리티는 origin → wp1 → wp2 → ... → destination 의 leg 마다 `routes[0].sections[i]` 를 1:1 로 만든다. 우리 측에서 추가 가공 없이 그대로 노출 — leg 카운트가 항상 `waypoints.length + 1` 이라 프론트가 안전하게 인덱싱 가능.
3. **빈 sectionPath skip**: 카카오가 인접 두 좌표가 너무 가까울 때 빈 section 을 돌려주는 케이스를 봤다. parseRoute 에서 `!sectionPath.isEmpty()` 가드로 sections 에 push 안 함. flat path 도 동일하게 영향 없음. 이 경우 `sections.length` 가 `waypoints.length + 1` 보다 작아질 수 있어 프론트는 길이를 신뢰하기보다 sections 자체를 iterate 하는 편이 안전.
4. **commit 보류**: task #2~#17 묶어 단일 commit (team-lead 지시).

---

# Task #20 — Visited flag on route DTOs (feat/trip-route-frontend)

## 작업 범위
프론트 trip route 화면에서 인증샷 보유 장소를 표시하기 위해 `RouteInitPlaceDto` / `SavedRouteItemDto` 에 `visited`, `visitedAt` 필드 추가. 익명 init 은 항상 `false`.

## 변경된 파일

### 수정 (production)
- `src/main/java/com/filmroad/api/domain/route/dto/RouteInitPlaceDto.java`
  - `boolean visited`, `Date visitedAt` 필드 추가.
  - factory 시그니처: `from(Place)` → `from(Place, Stamp)` (Stamp null OK → false).
- `src/main/java/com/filmroad/api/domain/route/dto/SavedRouteItemDto.java`
  - 동일 두 필드 + factory `from(RoutePlace, Stamp)`.
- `src/main/java/com/filmroad/api/domain/route/dto/RouteResponse.java`
  - factory: `from(Route)` → `from(Route, Map<Long, Stamp>)`. items 매핑 시 stamp lookup.
- `src/main/java/com/filmroad/api/domain/route/RouteCrudService.java`
  - `StampRepository` 의존 추가.
  - `initFromContent(contentId)`: `currentUser.currentUserIdOrNull()` 로 분기 — 비로그인이면 빈 맵, 로그인이면 `stampRepository.findByUserIdAndContentId` 1회 호출 → placeId 인덱스.
  - `getRoute / updateRoute`: `ownerStamps(route, userId)` 헬퍼로 `findByUserIdAndPlaceIdIn(userId, placeIds)` 1회 호출 → stamp 맵 → `RouteResponse.from(route, map)`. 빈 places 면 외부 호출 skip.
  - `indexStamps(List<Stamp>)`: placeId → Stamp 매핑 헬퍼.
- `src/main/java/com/filmroad/api/domain/route/Route.java`
  - `replacePlaces(List)` 의 내부를 `clearPlaces()` + `addPlaces(List)` 로 분리. createRoute 같은 신규 경로는 그대로 `replacePlaces` 호출.
  - 사유: 기존 places 가 있는 Route 를 update 할 때 한 flush 안에서 INSERT 가 DELETE 보다 먼저 실행돼 `(route_id, order_index)` 유니크 제약과 충돌. updateRoute 는 `clear → flush → add` 단계로 쪼개 orphan 삭제를 먼저 DB 에 반영.
  - 이전엔 update 응답에서 추가 SELECT 가 없어 commit 시점 flush 전 에 add 결과까지 메모리에 모아두고 H2 가 batch 처리해 우연히 통과했지만, 이제 `ownerStamps()` 의 SELECT 가 auto-flush 를 트리거해 잠재 버그가 표면화. update 자체의 정합성을 위한 영구 fix.

### 수정 (테스트)
- `src/test/java/com/filmroad/api/domain/route/RouteCrudServiceTest.java`
  - StampRepository mock 추가.
  - init: `initFromContent_anonymous_allVisitedFalse` (기존 happy 대체) + `initFromContent_loggedInWithPartialStamps` 추가 — anonymous 는 stamp 호출 없음 검증, 일부 stamp 시 visited true/false 분리 확인.
  - get: `getRoute_owner_returnsResponseWithVisited` (기존 happy 대체) + `getRoute_ownerNoStamps_allVisitedFalse` + `getRoute_emptyPlaces_skipsStampQuery` 추가.
  - update: 본인 update 테스트가 stamp 빈 응답 스텁 + visited=false 검증 추가.
- 신규 테스트 케이스 총 +3 (RouteCrudServiceTest 15 → 18).

## 프론트 contract (변경)
```json
GET /api/route/init?contentId=2
→ { "results": { ..., "places": [{ ..., "visited": bool, "visitedAt": "ISO8601|null" }, ...] } }

GET /api/route/{id}
→ { "results": { ..., "items":  [{ ..., "visited": bool, "visitedAt": "ISO8601|null" }, ...] } }
```
- 비로그인 init 호출 → 모든 place `visited=false`, `visitedAt=null`.
- 코스 단건 GET 은 owner 한정이므로 코스 소유자의 stamp 가 기준 — 다른 사용자의 stamp 는 영향 없음 (`findByUserIdAndPlaceIdIn` 의 userId 필터).

## 마이그레이션 안전성
- 스키마 변경 없음 — 기존 `stamp` 테이블만 조회.
- DTO 응답에 필드 추가 — 기존 클라이언트는 모르는 필드를 무시할 수 있어 호환성 유지.

## 테스트
- `./gradlew build` (WSL 우회) → BUILD SUCCESSFUL (2m 56s)
- 278 tests / 0 failures / 0 errors. 이전 265 → +13 (RouteCrudServiceTest +3, 기존 update 테스트는 stamp 스텁 추가 후 그린).

## 의사결정
1. **batch 1쿼리**: `findByUserIdAndPlaceIdIn(userId, ids)` 가 이미 컬렉션 detail 용도로 존재해 그대로 차용. N+1 회피.
2. **익명 init 분기**: `currentUserIdOrNull()` 이 null 이면 stamp 조회 자체를 skip. 미인증 호출 비용 0. 데모 fallback userId(1L) 로 잘못 해석되지 않도록 `currentUserId()` 가 아닌 `currentUserIdOrNull()` 사용.
3. **Route.clearPlaces / addPlaces 분리**: 이번 task 의 부수 작업. 기존 update 가 `replacePlaces` 한 번에 처리해 H2 트랜잭션 commit 시점 flush 에 의존했고, 새 SELECT 가 추가되며 mid-transaction flush 에서 unique 제약 충돌. clear/flush/add 3단계 로 분리해 영구 fix. createRoute 는 영향 없음 (replacePlaces 그대로 사용).
4. **다른 사용자 stamp 영향 없음**: `findByUserIdAndPlaceIdIn` 의 `userId` 필터로 보장. 별도 단위 테스트는 추가하지 않고 stub 으로 빈 결과 반환 시 visited=false 확인 (`getRoute_ownerNoStamps_allVisitedFalse`).
5. **commit 보류**: task #2~#21 묶어 단일 commit 예정 (team-lead 지시).

---

# Task #24 — `liked` flag on GalleryPhotoDto (feat/trip-route-frontend)

## 작업 범위
`/api/places/{id}/photos` 응답의 photos 항목에 viewer 의 좋아요 여부(`liked: boolean`) 노출. 비로그인 → 모두 false.

## 변경된 파일

### 수정 (production)
- `src/main/java/com/filmroad/api/domain/place/dto/GalleryPhotoDto.java`
  - `boolean liked` 필드 + Schema 코멘트.
  - factory 시그니처: `from(PlacePhoto)` → `from(PlacePhoto, boolean liked)`. Service 가 batch 조회 후 placeholder 로 채움.
- `src/main/java/com/filmroad/api/domain/place/GalleryService.java`
  - `PhotoLikeRepository` 의존 추가.
  - `currentUser.currentUserIdOrNull()` 로 비로그인 분기 — null 또는 빈 페이지면 외부 호출 skip + `Set.of()`.
  - 로그인 + 빈 페이지 아님 → `photoLikeRepository.findPhotoIdsLikedByUser(userId, photoIds)` **1회** 호출 → `HashSet`. (메서드 기존 존재, 신규 추가 없음.)
  - 매핑: `GalleryPhotoDto.from(p, likedIds.contains(p.getId()))`.

### 수정 (테스트)
- `src/test/java/com/filmroad/api/domain/place/GalleryControllerTest.java`
  - 신규 3 케이스:
    - `getPhotos_loggedInOwnerLikes_setsLikedTrueForLikedRows` — 시드 `photo_like(user 1, photo 100)` 활용 → photo 100 liked=true, 101/102 liked=false.
    - `getPhotos_otherUserLikes_dontLeakAcrossViewers` — viewer=user 2 → photo 100 liked=false (user 1 의 like 영향 없음).
    - `getPhotos_anonymous_allLikedFalse` — 비로그인 viewer → 모든 photos liked=false.

## 프론트 contract (변경)
```json
{ "results": {
    "photos": [
      { "id": 100, ..., "likeCount": 3, "liked": true },
      { "id": 101, ..., "likeCount": 1, "liked": false },
      ...
    ]
  }
}
```
- 비로그인 → 모든 항목 `liked: false`.
- 같은 페이지 내 photoIds 묶어 1회 쿼리 → N+1 free.

## 마이그레이션 안전성
- 스키마 변경 없음. 기존 `photo_like` 테이블만 조회.
- 응답에 필드 추가 — 기존 클라이언트 무영향.

## 테스트
- `./gradlew build` (WSL 우회) → BUILD SUCCESSFUL (3m 42s)
- 281 tests / 0 failures / 0 errors. 이전 278 → +3 (GalleryControllerTest 3건 추가, 기존 3건은 영향 없음).

## 의사결정
1. **`currentUserIdOrNull()` 사용**: GalleryService 의 viewerId 는 기존대로 `currentUserId()` (PRIVATE/FOLLOWERS 필터 + 데모 fallback). like 플래그는 별도 의미라 `currentUserIdOrNull()` 분기로 비로그인 = 0 쿼리 + 모두 false.
2. **빈 페이지 skip**: photos 가 0건이면 photoLikeRepository 호출 자체를 skip. `IN ()` 쿼리 보호.
3. **N+1 free**: 기존 `findPhotoIdsLikedByUser(userId, Collection<Long>)` 메서드 그대로 재사용 — placeId 기반 페이지 조회 후 그 페이지의 photoIds 만 IN 절로 1회 batch.
4. **commit 보류**: task #25 까지 끝나면 묶음 commit.

---

# Task #26 — `placeId` filter on `/api/feed` (feat/trip-route-frontend)

## 작업 범위
`/api/feed` 에 optional `placeId` query param 추가. contentId 필터 패턴 그대로 — 모든 tab 의 query 에 `(:placeId IS NULL OR pl.id = :placeId)` 절을 더해 직교 필터로 동작.

## 변경된 파일

### 수정 (production)
- `src/main/java/com/filmroad/api/domain/place/PlacePhotoRepository.java`
  - `findFeedRecent`, `findFeedPopular`, `findFeedByFollowedUsers` 시그니처에 `@Param("placeId") Long placeId` 추가.
  - 각 JPQL 의 WHERE 절에 `AND (:placeId IS NULL OR pl.id = :placeId)` 끼움.
- `src/main/java/com/filmroad/api/domain/feed/FeedService.java`
  - `getFeed(...)` 에 `Long placeId` 파라미터 추가, 각 tab 분기 query 호출에 thread.
  - `fetchNearby(...)` 시그니처에도 placeId 추가 (NEARBY 탭의 candidate fetch 도 placeId 필터 일관 적용).
- `src/main/java/com/filmroad/api/domain/feed/FeedController.java`
  - `@RequestParam(required = false) Long placeId` 추가, 그대로 service 로 패스.

### 수정 (테스트)
- `src/test/java/com/filmroad/api/domain/feed/FeedControllerTest.java`
  - `getFeed_placeIdFilter_returnsOnlyThatPlacesPhotos` — `placeId=10` → posts 모두 place 10, 첫 row id=105 (RECENT 정렬, place 10 photo 100..105 중 max).
  - `getFeed_placeIdAndPopular_combinesFilters` — `placeId=10&tab=POPULAR` → 첫 row id=100 (place 10 의 like_count 최상위).

## 프론트 contract
요청만 변경:
```
GET /api/feed?placeId=72&limit=20
GET /api/feed?placeId=72&tab=POPULAR
```
응답 shape (`FeedResponse`) 변화 없음 — `placeId` 옵션 미지정 시 기존 흐름 그대로.

## 마이그레이션 안전성
- 스키마 변경 없음.
- Repository 메서드 시그니처에 positional parameter 추가 — 모든 호출처(FeedService 내부) 함께 갱신. 테스트 회귀 없음.
- 응답 호환성 100% (placeId 미지정 = 기존 동작).

## 테스트
- `./gradlew build` (WSL 우회) → BUILD SUCCESSFUL (3m 35s)
- 283 tests / 0 failures / 0 errors. 이전 281 → +2.

## 의사결정
1. **시그니처 확장 vs 새 메서드**: 기존 메서드에 `placeId` positional param 을 추가했다. 새 메서드(`findFeedRecentByPlaceId` 등) 분리하면 `getFeed` 내부 분기가 (tab × placeId presence) 매트릭스로 폭증. JPQL 의 `(:p IS NULL OR …)` 패턴은 contentId 에서 이미 검증된 형태로 유지비 낮음.
2. **모든 tab 에 적용**: spec 은 RECENT/POPULAR 만 명시했지만 FOLLOWING/NEARBY/BY_CONTENT 도 같은 placeId 절을 포함시켜 조합 가능. 프론트에서 어떤 탭이 들어와도 일관 동작 — `tab=POPULAR&placeId=10` 같은 케이스에서 의외 결과 안 나오게 함.
3. **NEARBY 적용**: NEARBY 의 candidate fetch 도 placeId 필터를 거쳐, 한 place 가 다른 곳 추천에 섞이지 않게. lat/lng 미지정 시에도 동일.
4. **commit 보류**: task #27 까지 끝나면 묶음 commit.

