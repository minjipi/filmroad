package com.filmroad.api.domain.place;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.badge.Badge;
import com.filmroad.api.domain.badge.BadgeConditionType;
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
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PhotoUploadService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");
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

        String extension = extractExtension(file.getOriginalFilename());
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw BaseException.of(BaseResponseStatus.INVALID_FILE_TYPE);
        }

        String filename = UUID.randomUUID() + "." + extension;
        Path target = Paths.get(uploadPath).resolve(filename);

        try {
            Files.createDirectories(target.getParent());
            file.transferTo(target.toFile());
        } catch (IOException e) {
            throw BaseException.of(BaseResponseStatus.UPLOAD_FAILED);
        }

        int nextOrderIndex = placePhotoRepository.findMaxOrderIndexByPlaceId(place.getId()) + 1;
        PhotoVisibility visibility = req.getVisibility() != null ? req.getVisibility() : PhotoVisibility.PUBLIC;

        PlacePhoto savedPhoto = placePhotoRepository.save(PlacePhoto.builder()
                .place(place)
                .imageUrl("/uploads/" + filename)
                .authorNickname(null)
                .orderIndex(nextOrderIndex)
                .caption(req.getCaption())
                .visibility(visibility)
                .tagsCsv(normalizeTags(req.getTags()))
                .build());

        Long userId = currentUser.currentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.RESPONSE_NULL_ERROR));

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

    private static String extractExtension(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) return "";
        return filename.substring(dot + 1).toLowerCase();
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
