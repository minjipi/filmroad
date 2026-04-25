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
import lombok.extern.slf4j.Slf4j;
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
 * 인증샷 업로드 — 멀티 파일(최대 5장) 배치 검증 → DB 저장 → 파일 write 순으로 수행.
 * 모든 파일의 3단 검증(확장자·Content-Type·magic byte) 이 선통과해야 DB save 시작.
 * 파일 write 중 실패가 발생하면 이미 써진 파일은 best-effort 로 삭제하고 예외를 던져 트랜잭션 롤백.
 * 같은 batch 는 동일한 `groupKey` UUID 를 공유하여 ShotDetailPage carousel 이 묶어 노출.
 * reward (stamp / points / badge) 는 batch 당 1회만 산정 — 5장 올려도 포인트 5배 지급하지 않음.
 *
 * <h3>운영 전환 TODO (후속 task)</h3>
 * <ul>
 *   <li>로컬 filesystem → S3 (presigned URL 업로드, CDN 캐시 전면 적용). 현재는 `project.upload.path` 로컬 경로.</li>
 *   <li>orphan 파일 청소 — 트랜잭션 롤백 후 cleanup 실패 시 남는 파일 정리 job.</li>
 *   <li>썸네일 생성 파이프라인 — 업로드 시 Lambda/워커에서 320/640 리사이즈 원본 보관.</li>
 *   <li>백업 — S3 cross-region replication 또는 주기적 snapshot.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PhotoUploadService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");
    private static final Set<String> ALLOWED_CONTENT_TYPES =
            Set.of("image/jpeg", "image/jpg", "image/png", "image/webp");
    private static final Pattern EXT_SAFE = Pattern.compile("^[a-z0-9]{1,10}$");
    private static final int MAGIC_BYTE_PEEK = 12;
    // 한 batch 당 최대 파일 수. 초과 시 INVALID_FILE_TYPE 로 거절.
    private static final int MAX_FILES_PER_BATCH = 5;

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
    public PhotoUploadResponse upload(List<MultipartFile> files, PhotoUploadRequest req) {
        if (files == null || files.isEmpty()) {
            throw BaseException.of(BaseResponseStatus.INVALID_FILE_TYPE);
        }
        if (files.size() > MAX_FILES_PER_BATCH) {
            throw new BaseException(BaseResponseStatus.INVALID_FILE_TYPE,
                    "한 번에 " + MAX_FILES_PER_BATCH + "장까지만 업로드할 수 있어요.");
        }

        Place place = placeRepository.findById(req.getPlaceId())
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.PLACE_NOT_FOUND));

        // 1) 모든 파일을 선 검증 — 하나라도 실패하면 어떤 DB save / 파일 write 도 발생하지 않음.
        for (MultipartFile file : files) {
            validateFile(file);
        }

        Long userId = currentUser.currentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.RESPONSE_NULL_ERROR));

        PhotoVisibility visibility = req.getVisibility() != null ? req.getVisibility() : PhotoVisibility.PUBLIC;
        String dateBucket = LocalDate.now(UPLOAD_BUCKET_ZONE).format(DATE_BUCKET_FORMAT);
        Path uploadDir = Paths.get(uploadPath).toAbsolutePath().normalize();
        int nextOrderIndex = placePhotoRepository.findMaxOrderIndexByPlaceId(place.getId()) + 1;
        String tagsCsv = normalizeTags(req.getTags());

        // 2) DB 저장 먼저, 파일 write 는 가장 마지막 — file write 실패해도 트랜잭션 롤백으로 DB 엔티티 남지 않음.
        //    1 PlacePhoto post + N PlacePhotoImage (cascade ALL). 대표 url 은 images.get(0) 기준.
        PlacePhoto post = PlacePhoto.builder()
                .place(place)
                .user(user)
                .authorNickname(null)
                .orderIndex(nextOrderIndex)
                .caption(req.getCaption())
                .visibility(visibility)
                .tagsCsv(tagsCsv)
                .build();

        List<Path> pendingWrites = new ArrayList<>(files.size());
        for (int i = 0; i < files.size(); i++) {
            MultipartFile file = files.get(i);
            String extension = extractExtension(file.getOriginalFilename());
            String filename = UUID.randomUUID() + "." + extension;
            String relativePath = dateBucket + "/" + filename;
            Path target = uploadDir.resolve(relativePath).normalize();
            if (!target.startsWith(uploadDir)) {
                throw BaseException.of(BaseResponseStatus.INVALID_FILE_TYPE);
            }
            PlacePhotoImage image = PlacePhotoImage.builder()
                    .imageUrl("/uploads/" + relativePath)
                    .imageOrderIndex(i)
                    .build();
            post.addImage(image);  // 양방향 연결, cascade ALL 로 함께 persist
            pendingWrites.add(target);
        }

        PlacePhoto savedPost = placePhotoRepository.save(post);

        // Stamp / reward 는 batch 당 1회.
        if (!stampRepository.existsByUserIdAndPlaceId(userId, place.getId())) {
            stampRepository.save(Stamp.builder()
                    .user(user)
                    .place(place)
                    .photo(savedPost)
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

        // 3) 파일 write — 실패 시 지금까지 쓴 파일 best-effort 정리 + UPLOAD_FAILED throw → 트랜잭션 롤백.
        List<Path> written = new ArrayList<>(pendingWrites.size());
        try {
            for (int i = 0; i < files.size(); i++) {
                Path target = pendingWrites.get(i);
                Files.createDirectories(target.getParent());
                files.get(i).transferTo(target.toFile());
                written.add(target);
            }
        } catch (IOException e) {
            cleanupWrittenFiles(written);
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

        return PhotoUploadResponse.of(savedPost, stampReward, rewardDelta);
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw BaseException.of(BaseResponseStatus.INVALID_FILE_TYPE);
        }
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

    private static void cleanupWrittenFiles(List<Path> written) {
        for (Path p : written) {
            try {
                Files.deleteIfExists(p);
            } catch (IOException cleanupEx) {
                log.warn("[UPLOAD] batch 실패 후 orphan 파일 삭제 실패: {}", p, cleanupEx);
            }
        }
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

    private static String normalizeTags(String tags) {
        if (tags == null || tags.isBlank()) return null;
        String cleaned = Arrays.stream(tags.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.joining(","));
        return cleaned.isEmpty() ? null : cleaned;
    }
}
