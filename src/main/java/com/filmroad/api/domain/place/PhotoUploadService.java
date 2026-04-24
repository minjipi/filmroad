package com.filmroad.api.domain.place;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.badge.Badge;
import com.filmroad.api.domain.badge.BadgeRepository;
import com.filmroad.api.domain.badge.UserBadge;
import com.filmroad.api.domain.badge.UserBadgeRepository;
import com.filmroad.api.domain.badge.dto.UserBadgeDto;
import com.filmroad.api.domain.place.dto.PhotoUploadRequest;
import com.filmroad.api.domain.place.dto.PhotoUploadResponse;
import com.filmroad.api.domain.stamp.Stamp;
import com.filmroad.api.domain.stamp.StampRepository;
import com.filmroad.api.domain.stamp.dto.RewardDeltaDto;
import com.filmroad.api.domain.stamp.dto.StampRewardDto;
import com.filmroad.api.domain.user.User;
import com.filmroad.api.domain.user.UserRepository;
import com.filmroad.api.domain.user.dto.UserMeDto;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
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
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 인증샷 업로드 — 파일 검증 → DB 저장 → 파일 write 순으로 수행.
 * 파일 write 가 마지막이라, 검증/저장 중 실패가 나도 orphan 파일이 생기지 않는다.
 * (파일 write 자체가 실패하면 throw → 트랜잭션 롤백되어 DB 엔티티도 남지 않음.)
 *
 * <h3>운영 전환 TODO (후속 task)</h3>
 * <ul>
 *   <li>로컬 filesystem → S3 (presigned URL 업로드, CDN 캐시 전면 적용). 현재는 `project.upload.path` 로컬 경로.</li>
 *   <li>orphan 파일 청소 — DB 트랜잭션 커밋 이후 파일 write 가 FS 오류로 실패하는 경우 대비
 *       주기적 스윕 job (예: PlacePhoto.imageUrl 과 실제 파일 시스템 diff) 추가.</li>
 *   <li>썸네일 생성 파이프라인 — 업로드 시 Lambda/워커에서 320/640 리사이즈 원본 보관.</li>
 *   <li>백업 — S3 cross-region replication 또는 주기적 snapshot.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class PhotoUploadService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");
    private static final Set<String> ALLOWED_CONTENT_TYPES =
            Set.of("image/jpeg", "image/jpg", "image/png", "image/webp");
    // 확장자 입력 우회 방어: 영문/숫자만 허용.
    private static final Pattern EXT_SAFE = Pattern.compile("^[a-z0-9]{1,10}$");
    private static final int MAGIC_BYTE_PEEK = 12;

    // 업로드 파일은 `yyyy/MM/dd` 서브폴더로 분산. 해외 배포에서도 동일한 bucketing 을 보장하려면
    // KST 기준으로 고정 (JVM 기본 타임존이 UTC 일 때 날짜 경계가 어긋나는 걸 방지).
    private static final ZoneId UPLOAD_BUCKET_ZONE = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter DATE_BUCKET_FORMAT = DateTimeFormatter.ofPattern("yyyy/MM/dd");

    private static final int POINTS_PER_UPLOAD = 50;
    private static final int POINTS_PER_LEVEL = 100;
    private static final int MAX_LEVEL = 10;

    private final PlacePhotoRepository placePhotoRepository;
    private final PlaceRepository placeRepository;
    private final UserRepository userRepository;
    private final StampRepository stampRepository;
    private final BadgeRepository badgeRepository;
    private final UserBadgeRepository userBadgeRepository;
    private final CurrentUser currentUser;

    @Value("${project.upload.path}")
    private String uploadPath;

    @Transactional
    public PhotoUploadResponse upload(MultipartFile file, PhotoUploadRequest req) {
        if (file == null || file.isEmpty()) {
            throw BaseException.of(BaseResponseStatus.INVALID_FILE_TYPE);
        }

        Place place = placeRepository.findById(req.getPlaceId())
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.PLACE_NOT_FOUND));

        // 확장자 + Content-Type + magic byte 3단 검증. 한 개라도 통과 못 하면 업로드 거부.
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

        // yyyy/MM/dd 서브폴더로 분산 저장. 한 디렉토리에 수천 수만 파일이 쌓이는 걸 막고
        // 백업/아카이빙을 날짜 단위로 쪼갤 수 있게 함. 경로는 서비스 단에서 KST 고정.
        String dateBucket = LocalDate.now(UPLOAD_BUCKET_ZONE).format(DATE_BUCKET_FORMAT);
        String filename = UUID.randomUUID() + "." + extension;
        String relativePath = dateBucket + "/" + filename;

        Path uploadDir = Paths.get(uploadPath).toAbsolutePath().normalize();
        Path target = uploadDir.resolve(relativePath).normalize();
        // Path traversal 2차 방어 — 어떤 이유로든 target 이 uploadDir 바깥을 가리키면 거부.
        if (!target.startsWith(uploadDir)) {
            throw BaseException.of(BaseResponseStatus.INVALID_FILE_TYPE);
        }

        int nextOrderIndex = placePhotoRepository.findMaxOrderIndexByPlaceId(place.getId()) + 1;
        PhotoVisibility visibility = req.getVisibility() != null ? req.getVisibility() : PhotoVisibility.PUBLIC;

        Long userId = currentUser.currentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.RESPONSE_NULL_ERROR));

        // --- DB 저장 먼저, 파일 write 가장 마지막 ---
        PlacePhoto savedPhoto = placePhotoRepository.save(PlacePhoto.builder()
                .place(place)
                .user(user)
                .imageUrl("/uploads/" + relativePath)
                .authorNickname(null)
                .orderIndex(nextOrderIndex)
                .caption(req.getCaption())
                .visibility(visibility)
                .tagsCsv(normalizeTags(req.getTags()))
                .build());

        if (!stampRepository.existsByUserIdAndPlaceId(userId, place.getId())) {
            stampRepository.save(Stamp.builder()
                    .user(user)
                    .place(place)
                    .photo(savedPhoto)
                    .build());
        }

        int newStreakDays = Math.max(1, user.getStreakDays() + 1);
        int newPoints = user.getPoints() + POINTS_PER_UPLOAD;
        int newLevel = Math.min(MAX_LEVEL, newPoints / POINTS_PER_LEVEL + 1);
        user.applyUploadReward(POINTS_PER_UPLOAD, newStreakDays, newLevel);
        userRepository.save(user);

        long stampCount = stampRepository.countByUserId(userId);
        long workStampCount = stampRepository.countByUserIdAndWorkId(userId, place.getWork().getId());
        long workTotalCount = placeRepository.countByWorkId(place.getWork().getId());
        int workPercent = workTotalCount == 0 ? 0 : (int) Math.round(100.0 * workStampCount / workTotalCount);

        List<UserBadgeDto> newBadges = awardBadges(user, place, stampCount, workStampCount, workTotalCount);

        // DB 검증/저장 전부 성공 후, 마지막으로 파일을 실제 디스크에 기록.
        // 여기서 IO 예외가 나면 트랜잭션 롤백되어 방금 저장한 PlacePhoto·Stamp·User 포인트 변경도 되돌아간다.
        try {
            Files.createDirectories(target.getParent());
            file.transferTo(target.toFile());
        } catch (IOException e) {
            throw BaseException.of(BaseResponseStatus.UPLOAD_FAILED);
        }

        StampRewardDto stampReward = StampRewardDto.builder()
                .placeName(place.getName())
                .workId(place.getWork().getId())
                .workTitle(place.getWork().getTitle())
                .collectedCount(workStampCount)
                .totalCount(workTotalCount)
                .percent(workPercent)
                .build();

        RewardDeltaDto rewardDelta = RewardDeltaDto.builder()
                .pointsEarned(POINTS_PER_UPLOAD)
                .currentPoints(user.getPoints())
                .streakDays(user.getStreakDays())
                .level(user.getLevel())
                .levelName(UserMeDto.levelName(user.getLevel()))
                .newBadges(newBadges)
                .build();

        return PhotoUploadResponse.of(savedPhoto, stampReward, rewardDelta);
    }

    private List<UserBadgeDto> awardBadges(User user, Place place, long stampCount, long workStampCount, long workTotalCount) {
        List<UserBadgeDto> awarded = new ArrayList<>();
        List<Badge> catalog = badgeRepository.findAllByOrderByOrderIndexAsc();
        for (Badge b : catalog) {
            if (userBadgeRepository.existsByUserIdAndBadgeId(user.getId(), b.getId())) continue;
            boolean met = switch (b.getConditionType()) {
                case STAMP_COUNT -> b.getConditionThreshold() != null && stampCount >= b.getConditionThreshold();
                case STREAK -> b.getConditionThreshold() != null && user.getStreakDays() >= b.getConditionThreshold();
                case WORK_COMPLETE -> b.getConditionWorkId() != null
                        && b.getConditionWorkId().equals(place.getWork().getId())
                        && workTotalCount > 0
                        && workStampCount >= workTotalCount;
                default -> false;
            };
            if (met) {
                UserBadge ub = userBadgeRepository.save(UserBadge.builder().user(user).badge(b).build());
                awarded.add(UserBadgeDto.acquired(ub, "방금 획득"));
            }
        }
        return awarded;
    }

    /**
     * 파일 첫 바이트로 JPEG/PNG/WebP signature 확인. 확장자·Content-Type 우회 공격 방어.
     */
    private static boolean isImageMagicByteValid(MultipartFile file) {
        byte[] head;
        try (InputStream is = file.getInputStream()) {
            head = is.readNBytes(MAGIC_BYTE_PEEK);
        } catch (IOException e) {
            return false;
        }
        if (head == null || head.length < 4) return false;
        // JPEG: FF D8 FF
        if ((head[0] & 0xFF) == 0xFF && (head[1] & 0xFF) == 0xD8 && (head[2] & 0xFF) == 0xFF) {
            return true;
        }
        // PNG: 89 50 4E 47
        if ((head[0] & 0xFF) == 0x89 && head[1] == 'P' && head[2] == 'N' && head[3] == 'G') {
            return true;
        }
        // WebP: "RIFF" .... "WEBP"
        if (head.length >= 12 && head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
                && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P') {
            return true;
        }
        return false;
    }

    private static String extractExtension(String filename) {
        if (filename == null) return "";
        // path separator 가 남아있어도 마지막 파일명만 본다 — "../evil.jsp" 같은 케이스 방어.
        String base = filename.replace('\\', '/');
        int slash = base.lastIndexOf('/');
        if (slash >= 0) base = base.substring(slash + 1);
        int dot = base.lastIndexOf('.');
        if (dot < 0 || dot == base.length() - 1) return "";
        return base.substring(dot + 1).toLowerCase();
    }

    private static String normalizeTags(String tags) {
        if (tags == null || tags.isBlank()) return null;
        String cleaned = Arrays.stream(tags.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.joining(","));
        return cleaned.isEmpty() ? null : cleaned;
    }
}
