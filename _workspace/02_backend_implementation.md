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
