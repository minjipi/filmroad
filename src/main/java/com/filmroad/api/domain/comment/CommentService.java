package com.filmroad.api.domain.comment;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.comment.dto.CommentDto;
import com.filmroad.api.domain.comment.dto.CommentListResponse;
import com.filmroad.api.domain.place.PhotoVisibilityGuard;
import com.filmroad.api.domain.place.PlacePhoto;
import com.filmroad.api.domain.place.PlacePhotoRepository;
import com.filmroad.api.domain.user.User;
import com.filmroad.api.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class CommentService {

    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 50;

    /*
     * 인증샷 댓글 이미지 검증 — PhotoUploadService 의 3단 검증(확장자·Content-Type·magic byte)
     * 패턴을 그대로 복제. 공통화 리팩토링은 후속 task 에서.
     */
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");
    private static final Set<String> ALLOWED_CONTENT_TYPES =
            Set.of("image/jpeg", "image/jpg", "image/png", "image/webp");
    private static final Pattern EXT_SAFE = Pattern.compile("^[a-z0-9]{1,10}$");
    private static final int MAGIC_BYTE_PEEK = 12;

    private static final ZoneId UPLOAD_BUCKET_ZONE = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter DATE_BUCKET_FORMAT = DateTimeFormatter.ofPattern("yyyy/MM/dd");
    /** 인증샷 댓글 이미지는 place 사진과 분리하기 위해 별도 서브디렉토리. */
    private static final String COMMENT_BUCKET_PREFIX = "comments";

    private final PostCommentRepository postCommentRepository;
    private final PlacePhotoRepository placePhotoRepository;
    private final UserRepository userRepository;
    private final CurrentUser currentUser;
    private final PhotoVisibilityGuard photoVisibilityGuard;

    @Value("${project.upload.path}")
    private String uploadPath;

    @Transactional
    public CommentDto createComment(Long photoId, String content, MultipartFile image, Long parentId) {
        String trimmed = content == null ? "" : content.trim();
        if (trimmed.isEmpty() || trimmed.length() > 500) {
            throw BaseException.of(BaseResponseStatus.REQUEST_ERROR);
        }

        boolean hasImage = image != null && !image.isEmpty();
        if (hasImage) {
            validateImage(image);
        }

        PlacePhoto photo = placePhotoRepository.findById(photoId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.PHOTO_NOT_FOUND));
        // PRIVATE / FOLLOWERS 사진에 비작성자 / 비팔로워가 직접 댓글 API 를 호출
        // 하는 경로 차단. 권한 없음은 PHOTO_NOT_FOUND 로 통일 (enumeration 차단).
        photoVisibilityGuard.assertViewable(photo, currentUser.currentUserId());

        // 답글: parent 존재해야 하고, 같은 photo 소속이어야 하며, parent 자체가
        // 답글이면 거부한다 (1단계 깊이만 허용 — Instagram / KakaoTalk 패턴).
        PostComment parent = null;
        if (parentId != null) {
            parent = postCommentRepository.findById(parentId)
                    .orElseThrow(() -> BaseException.of(BaseResponseStatus.COMMENT_NOT_FOUND));
            if (!parent.getPlacePhoto().getId().equals(photoId)) {
                throw BaseException.of(BaseResponseStatus.COMMENT_NOT_FOUND);
            }
            if (parent.getParent() != null) {
                throw BaseException.of(BaseResponseStatus.REQUEST_ERROR);
            }
        }

        Long userId = currentUser.currentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.RESPONSE_NULL_ERROR));

        String savedImageUrl = null;
        Path writtenPath = null;

        if (hasImage) {
            // PlacePhoto 업로드와 동일하게 url prefix 는 "/uploads/..." (정적 매핑 경로) 그대로 유지.
            String extension = extractExtension(image.getOriginalFilename());
            String dateBucket = LocalDate.now(UPLOAD_BUCKET_ZONE).format(DATE_BUCKET_FORMAT);
            String filename = UUID.randomUUID() + "." + extension;
            String relativePath = COMMENT_BUCKET_PREFIX + "/" + dateBucket + "/" + filename;

            Path uploadDir = Paths.get(uploadPath).toAbsolutePath().normalize();
            Path target = uploadDir.resolve(relativePath).normalize();
            if (!target.startsWith(uploadDir)) {
                throw BaseException.of(BaseResponseStatus.INVALID_FILE_TYPE);
            }

            try {
                Files.createDirectories(target.getParent());
                image.transferTo(target.toFile());
                writtenPath = target;
            } catch (IOException e) {
                cleanupWrittenFile(target);
                log.warn("[COMMENT_UPLOAD] 인증샷 파일 저장 실패: {}", target, e);
                throw BaseException.of(BaseResponseStatus.UPLOAD_FAILED);
            }
            savedImageUrl = "/uploads/" + relativePath;
        }

        try {
            PostComment saved = postCommentRepository.save(PostComment.builder()
                    .user(user)
                    .placePhoto(photo)
                    .content(trimmed)
                    .imageUrl(savedImageUrl)
                    .parent(parent)
                    .build());

            photo.applyCommentDelta(1);
            return CommentDto.from(saved);
        } catch (RuntimeException e) {
            // DB 저장 실패 → 이미 쓴 인증샷은 best-effort 정리. 트랜잭션은 자동 롤백.
            cleanupWrittenFile(writtenPath);
            throw e;
        }
    }

    @Transactional
    public void deleteComment(Long commentId) {
        Long userId = currentUser.currentUserId();
        PostComment comment = postCommentRepository.findById(commentId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.COMMENT_NOT_FOUND));
        if (!postCommentRepository.existsByIdAndUserId(commentId, userId)) {
            throw BaseException.of(BaseResponseStatus.UNAUTHORIZED_COMMENT);
        }
        PlacePhoto photo = comment.getPlacePhoto();

        // 답글이 달려있으면 함께 정리 — DB FK cascade 대신 service 단에서 명시적으로
        // 자식을 처리해야 (a) 자식의 첨부 이미지 파일 cleanup, (b) photo.commentCount
        // 정확한 차감, (c) JPA 영속성 컨텍스트 일관성 모두 챙길 수 있다. depth=1
        // 정책이라 자식의 자식은 존재할 수 없음.
        List<PostComment> replies = postCommentRepository.findByParentId(commentId);
        for (PostComment r : replies) {
            cleanupStoredImage(r.getImageUrl());
        }
        if (!replies.isEmpty()) {
            postCommentRepository.deleteAll(replies);
            photo.applyCommentDelta(-replies.size());
        }

        cleanupStoredImage(comment.getImageUrl());
        postCommentRepository.delete(comment);
        photo.applyCommentDelta(-1);
    }

    /**
     * 저장된 댓글 이미지 URL("/uploads/comments/yyyy/MM/dd/{uuid}.jpg") 의 실제
     * 파일을 best-effort 로 삭제. URL 이 null 이거나 매핑 prefix 가 다르면 noop.
     * 실패해도 본 작업(댓글 삭제) 은 그대로 진행 — 디스크 cleanup 은 보조.
     */
    private void cleanupStoredImage(String storedUrl) {
        if (storedUrl == null) return;
        final String prefix = "/uploads/";
        if (!storedUrl.startsWith(prefix)) return;
        String relative = storedUrl.substring(prefix.length());
        Path uploadDir = Paths.get(uploadPath).toAbsolutePath().normalize();
        Path target = uploadDir.resolve(relative).normalize();
        if (!target.startsWith(uploadDir)) return;  // path traversal 방어
        cleanupWrittenFile(target);
    }

    @Transactional(readOnly = true)
    public CommentListResponse listComments(Long photoId, Long cursor, int limit) {
        // create 와 같은 visibility 가드 — 다른 사람의 PRIVATE / FOLLOWERS 사진의
        // 댓글 목록을 ID 추측만으로 긁는 경로 차단. 사진 자체가 없으면 동일하게
        // PHOTO_NOT_FOUND.
        PlacePhoto photo = placePhotoRepository.findById(photoId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.PHOTO_NOT_FOUND));
        photoVisibilityGuard.assertViewable(photo, currentUser.currentUserId());

        int safeLimit = limit <= 0 ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);
        long safeCursor = cursor == null ? 0L : cursor;
        int fetchSize = safeLimit + 1;

        List<PostComment> fetched = postCommentRepository.findPageByPhoto(photoId, safeCursor, PageRequest.of(0, fetchSize));
        boolean hasMore = fetched.size() > safeLimit;
        List<PostComment> page = hasMore ? fetched.subList(0, safeLimit) : fetched;
        Long nextCursor = hasMore && !page.isEmpty() ? page.get(page.size() - 1).getId() : null;

        return CommentListResponse.builder()
                .comments(page.stream().map(CommentDto::from).toList())
                .hasMore(hasMore)
                .nextCursor(nextCursor)
                .build();
    }

    /* ---- helpers (PhotoUploadService 패턴 복제) ---- */

    private static void validateImage(MultipartFile file) {
        String extension = extractExtension(file.getOriginalFilename());
        if (!EXT_SAFE.matcher(extension).matches() || !ALLOWED_EXTENSIONS.contains(extension)) {
            throw BaseException.of(BaseResponseStatus.INVALID_FILE_TYPE);
        }
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw BaseException.of(BaseResponseStatus.INVALID_FILE_TYPE);
        }
        if (!isImageMagicByteValid(file)) {
            throw BaseException.of(BaseResponseStatus.INVALID_FILE_TYPE);
        }
    }

    private static boolean isImageMagicByteValid(MultipartFile file) {
        byte[] head;
        try (InputStream is = file.getInputStream()) {
            head = is.readNBytes(MAGIC_BYTE_PEEK);
        } catch (IOException e) {
            return false;
        }
        if (head == null || head.length < 4) return false;
        if ((head[0] & 0xFF) == 0xFF && (head[1] & 0xFF) == 0xD8 && (head[2] & 0xFF) == 0xFF) {
            return true;
        }
        if ((head[0] & 0xFF) == 0x89 && head[1] == 'P' && head[2] == 'N' && head[3] == 'G') {
            return true;
        }
        if (head.length >= 12 && head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
                && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P') {
            return true;
        }
        return false;
    }

    private static String extractExtension(String filename) {
        if (filename == null) return "";
        String base = filename.replace('\\', '/');
        int slash = base.lastIndexOf('/');
        if (slash >= 0) base = base.substring(slash + 1);
        int dot = base.lastIndexOf('.');
        if (dot < 0 || dot == base.length() - 1) return "";
        return base.substring(dot + 1).toLowerCase();
    }

    private static void cleanupWrittenFile(Path path) {
        if (path == null) return;
        try {
            Files.deleteIfExists(path);
        } catch (IOException cleanupEx) {
            log.warn("[COMMENT_UPLOAD] 실패 후 orphan 파일 삭제 실패: {}", path, cleanupEx);
        }
    }
}
