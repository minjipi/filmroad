# Backend Implementation — feat/comment-verification-photo

## 작업 범위
인증샷 댓글 (`POST /api/photos/{photoId}/comments`) 의 multipart 전환과 `image_url` 컬럼 추가.

## 변경된 파일

### 신규 / 수정 (production)
- `src/main/java/com/filmroad/api/domain/comment/PostComment.java` — `image_url VARCHAR(500) NULL` 컬럼 추가.
- `src/main/java/com/filmroad/api/domain/comment/dto/CommentDto.java` — `imageUrl: String?` 필드 추가, `from(...)` 매핑 갱신.
- `src/main/java/com/filmroad/api/domain/comment/CommentController.java` — `@RequestBody JSON` → `multipart/form-data` (`@RequestParam content` + `@RequestPart(required=false) image`) 로 시그니처 변경.
- `src/main/java/com/filmroad/api/domain/comment/CommentService.java` — `createComment(Long, String, MultipartFile)` 로 확장. PhotoUploadService 의 3단 검증 (확장자·Content-Type·magic byte) 패턴을 인라인으로 복제하고 `comments/yyyy/MM/dd/{uuid}.{ext}` 경로에 저장.

### 삭제
- `src/main/java/com/filmroad/api/domain/comment/dto/CommentCreateRequest.java` — multipart 전환으로 더 이상 사용되지 않음.

### 테스트
- `src/test/java/com/filmroad/api/domain/comment/CommentControllerTest.java` — multipart 케이스로 전면 재작성. 기존 4 케이스 유지 + 6 신규 케이스.

## API 계약 (프론트와 합의된 스펙)

### 요청
```
POST /api/photos/{photoId}/comments
Content-Type: multipart/form-data

content=...           (form field, required, max 500자)
image=<binary>        (file part, optional, 1장)
```

### 응답 (`CommentDto`)
```json
{
  "id": 12,
  "content": "여기 진짜로 다녀왔어요",
  "imageUrl": "/uploads/comments/2026/04/26/{uuid}.jpg",
  "createdAt": "2026-04-26T00:48:30.000+09:00",
  "author": { "userId": 1, "nickname": "...", "profileImageUrl": "..." }
}
```
- 인증샷이 없는 댓글이면 `imageUrl: null`.
- `GET /api/photos/{photoId}/comments` 의 각 항목도 동일하게 `imageUrl` 포함.

### curl 예시
```bash
# 인증샷 첨부 댓글
curl -X POST 'http://localhost:8080/api/photos/100/comments' \
  -H 'Cookie: ATOKEN=...' \
  -F 'content=여기 진짜로 다녀왔어요' \
  -F 'image=@/path/to/verify.jpg'

# 텍스트-only (image 생략)
curl -X POST 'http://localhost:8080/api/photos/100/comments' \
  -H 'Cookie: ATOKEN=...' \
  -F 'content=좋은 사진이네요'
```

### 에러 응답
- 허용되지 않은 확장자 / MIME / 매직바이트 깨짐 → HTTP 400, `code: 40060` (`INVALID_FILE_TYPE`).
- 5MB(현재 yml 기본 10MB) 초과 → HTTP 413, `code: 40061` (`UPLOAD_FAILED`) — 기존 `GlobalExceptionHandler` 의 `handleMaxUploadSize` 가 처리.
- 빈 `content` 또는 길이 초과 → HTTP 400, `REQUEST_ERROR`.

## 마이그레이션 / 스키마

### 컬럼 추가
- `post_comment.image_url VARCHAR(500) NULL`.
- Hibernate `ddl-auto=update` 가 자동으로 `ALTER TABLE post_comment ADD COLUMN image_url VARCHAR(500)` 발행. 기존 row 는 `NULL` 채워짐 → 백워드 호환.
- `LegacyPhotoSchemaMigration` 같은 부팅 시 보정 코드는 **불필요**. 그 클래스는 Hibernate 가 자동 처리하지 못하는 *drop* 만 다루기 위한 것이며, *nullable column add* 는 update 모드의 정상 경로.

### 파일 저장 경로
- `${project.upload.path}/comments/yyyy/MM/dd/{uuid}.{ext}`.
- 응답 `imageUrl` 은 정적 매핑(`/uploads/**`) prefix 그대로: `"/uploads/comments/2026/04/26/{uuid}.jpg"`.
- 파일 write 실패 시 best-effort 삭제 후 `UPLOAD_FAILED` throw, DB save 실패 시 작성된 파일 정리 + 트랜잭션 롤백.

### 검증 패턴
- `ALLOWED_EXTENSIONS = {jpg, jpeg, png, webp}`
- `ALLOWED_CONTENT_TYPES = {image/jpeg, image/jpg, image/png, image/webp}`
- `EXT_SAFE = ^[a-z0-9]{1,10}$`
- magic byte peek 12 bytes — JPEG (FF D8 FF) / PNG (89 50 4E 47) / RIFF…WEBP.
- 파일 사이즈 상한은 `spring.servlet.multipart.max-file-size` (현재 10MB) — 하드코딩 없음.

## 테스트 결과

`./gradlew build` SUCCESSFUL.
`./gradlew test` — total **143 tests, 0 failures, 0 errors**.

`CommentControllerTest` — 10/10 PASS:
- `POST /api/photos/100/comments multipart with text only returns CommentDto, imageUrl null`
- `POST /api/photos/100/comments with image part returns imageUrl pointing under /uploads/comments/`
- `POST /api/photos/100/comments accepts PNG when extension/MIME/magic byte all align`
- `POST /api/photos/100/comments without ATOKEN returns 401`
- `POST /api/photos/100/comments with disallowed extension returns 4xx INVALID_FILE_TYPE`
- `POST /api/photos/100/comments with mismatched content-type returns 4xx INVALID_FILE_TYPE`
- `POST /api/photos/100/comments with bad magic byte returns 4xx INVALID_FILE_TYPE`
- `GET /api/photos/100/comments returns seeded comments with imageUrl field serialized`
- `DELETE /api/comments/{id} by the author returns 204`
- `DELETE /api/comments/{id} by another user returns 403 UNAUTHORIZED_COMMENT`

## 프론트엔드 전달 사항 (frontend-dev)
1. `POST /api/photos/{id}/comments` 가 **JSON → multipart/form-data** 로 변경됨. 폼 필드명은 `content`, 파일 파트명은 `image` (모두 소문자, 단일).
2. 응답/리스트 응답에 `imageUrl: string | null` 필드가 추가됨. 인증샷 댓글 UI 에서 `imageUrl` 이 truthy 일 때만 썸네일 렌더.
3. 5MB 정도의 이미지면 안전. 10MB 초과 시 백엔드가 413 / `UPLOAD_FAILED` 로 응답. 클라이언트 단에서 size guard 권장.
4. `frontend/src/services/comment*.ts` (또는 동등) 의 axios 호출에서 `Content-Type: application/json` 보내면 415. multipart 로 전환 필요.
