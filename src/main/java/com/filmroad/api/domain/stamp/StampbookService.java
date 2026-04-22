package com.filmroad.api.domain.stamp;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.domain.badge.Badge;
import com.filmroad.api.domain.badge.BadgeConditionType;
import com.filmroad.api.domain.badge.BadgeRepository;
import com.filmroad.api.domain.badge.UserBadge;
import com.filmroad.api.domain.badge.UserBadgeRepository;
import com.filmroad.api.domain.badge.dto.UserBadgeDto;
import com.filmroad.api.domain.place.PlaceRepository;
import com.filmroad.api.domain.stamp.dto.StampbookHeroDto;
import com.filmroad.api.domain.stamp.dto.StampbookResponse;
import com.filmroad.api.domain.stamp.dto.WorkProgressDto;
import com.filmroad.api.domain.user.User;
import com.filmroad.api.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StampbookService {

    private static final int LOCKED_BADGE_LIMIT = 3;
    private static final String[] WORK_GRADIENTS = {"sky-violet", "amber-coral", "mint-sky", "indigo-violet", "ink-violet"};

    private final StampRepository stampRepository;
    private final UserRepository userRepository;
    private final PlaceRepository placeRepository;
    private final BadgeRepository badgeRepository;
    private final UserBadgeRepository userBadgeRepository;
    private final CurrentUser currentUser;

    @Transactional(readOnly = true)
    public StampbookResponse getStampbook() {
        Long userId = currentUser.currentUserId();
        User user = userRepository.findById(userId).orElse(null);

        List<Stamp> allStamps = stampRepository.findByUserIdOrderByAcquiredAtDesc(userId);
        long stampCount = allStamps.size();

        Map<Long, List<Stamp>> stampsByWork = allStamps.stream()
                .collect(Collectors.groupingBy(s -> s.getPlace().getWork().getId()));

        List<WorkProgressDto> works = new ArrayList<>();
        long completedWorksCount = 0;
        for (Map.Entry<Long, List<Stamp>> entry : stampsByWork.entrySet()) {
            Long workId = entry.getKey();
            List<Stamp> stamps = entry.getValue();
            long collectedCount = stamps.size();
            long totalCount = placeRepository.countByWorkId(workId);
            int percent = totalCount == 0 ? 0 : (int) Math.round(100.0 * collectedCount / totalCount);
            boolean completed = totalCount > 0 && collectedCount >= totalCount;
            if (completed) completedWorksCount++;

            Stamp sample = stamps.get(0);
            works.add(WorkProgressDto.builder()
                    .workId(workId)
                    .title(sample.getPlace().getWork().getTitle())
                    .posterUrl(sample.getPlace().getWork().getPosterUrl())
                    .year(null)
                    .collectedCount(collectedCount)
                    .totalCount(totalCount)
                    .percent(percent)
                    .completed(completed)
                    .gradient(WORK_GRADIENTS[(int) (workId % WORK_GRADIENTS.length)])
                    .build());
        }
        works.sort((a, b) -> Long.compare(a.getWorkId(), b.getWorkId()));

        List<UserBadge> acquiredUserBadges = userBadgeRepository.findByUserIdOrderByAcquiredAtDesc(userId);
        Set<Long> acquiredBadgeIds = acquiredUserBadges.stream()
                .map(ub -> ub.getBadge().getId())
                .collect(Collectors.toCollection(HashSet::new));

        List<UserBadgeDto> recentBadges = new ArrayList<>();
        for (UserBadge ub : acquiredUserBadges) {
            recentBadges.add(UserBadgeDto.acquired(ub, formatAcquiredProgress(ub.getBadge())));
        }

        List<Badge> allBadges = badgeRepository.findAllByOrderByOrderIndexAsc();
        int lockedAdded = 0;
        for (Badge b : allBadges) {
            if (lockedAdded >= LOCKED_BADGE_LIMIT) break;
            if (acquiredBadgeIds.contains(b.getId())) continue;
            recentBadges.add(UserBadgeDto.locked(b, formatLockedProgress(b, userId, stampCount, user)));
            lockedAdded++;
        }

        StampbookHeroDto hero = StampbookHeroDto.builder()
                .worksCollectingCount(stampsByWork.size())
                .placesCollectedCount(stampCount)
                .badgesCount(acquiredUserBadges.size())
                .completedWorksCount(completedWorksCount)
                .build();

        return StampbookResponse.builder()
                .hero(hero)
                .works(works)
                .recentBadges(recentBadges)
                .build();
    }

    private String formatAcquiredProgress(Badge b) {
        if (b.getConditionThreshold() == null) return "완료";
        return b.getConditionThreshold() + " / " + b.getConditionThreshold() + unitFor(b.getConditionType());
    }

    private String formatLockedProgress(Badge b, Long userId, long stampCount, User user) {
        int current = switch (b.getConditionType()) {
            case STAMP_COUNT -> (int) stampCount;
            case STREAK -> user == null ? 0 : user.getStreakDays();
            case WORK_COMPLETE -> b.getConditionWorkId() == null
                    ? 0
                    : (int) stampRepository.countByUserIdAndWorkId(userId, b.getConditionWorkId());
            default -> 0;
        };
        int threshold;
        if (b.getConditionType() == BadgeConditionType.WORK_COMPLETE && b.getConditionWorkId() != null) {
            threshold = (int) placeRepository.countByWorkId(b.getConditionWorkId());
        } else {
            threshold = b.getConditionThreshold() == null ? 0 : b.getConditionThreshold();
        }
        return current + " / " + threshold + unitFor(b.getConditionType());
    }

    private String unitFor(BadgeConditionType type) {
        return switch (type) {
            case STAMP_COUNT -> " 성지";
            case STREAK -> " 일";
            case REGION_COUNT -> " 지역";
            case COASTAL_COUNT -> " 곳";
            case WORK_COMPLETE -> " 장소";
            case EARLY_BIRD -> "";
        };
    }
}
