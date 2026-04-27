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
