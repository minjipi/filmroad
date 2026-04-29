package com.filmroad.api.domain.content;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.badge.Badge;
import com.filmroad.api.domain.badge.BadgeConditionType;
import com.filmroad.api.domain.badge.BadgeRepository;
import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceCoverImage;
import com.filmroad.api.domain.place.PlaceRepository;
import com.filmroad.api.domain.place.dto.PlaceSceneDto;
import com.filmroad.api.domain.stamp.Stamp;
import com.filmroad.api.domain.stamp.StampRepository;
import com.filmroad.api.domain.content.dto.ContentDetailDto;
import com.filmroad.api.domain.content.dto.ContentDetailResponse;
import com.filmroad.api.domain.content.dto.ContentProgressSummaryDto;
import com.filmroad.api.domain.content.dto.ContentSpotDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ContentDetailService {

    private final ContentRepository contentRepository;
    private final PlaceRepository placeRepository;
    private final StampRepository stampRepository;
    private final BadgeRepository badgeRepository;
    private final CurrentUser currentUser;

    @Transactional(readOnly = true)
    public ContentDetailResponse getContent(Long contentId) {
        Content work = contentRepository.findById(contentId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.WORK_NOT_FOUND));

        Long userId = currentUser.currentUserId();
        List<Place> places = placeRepository.findByWorkIdOrderByIdAsc(contentId);

        List<Stamp> userStamps = stampRepository.findByUserIdAndWorkId(userId, contentId);
        Map<Long, Stamp> stampByPlaceId = new HashMap<>();
        for (Stamp s : userStamps) {
            stampByPlaceId.put(s.getPlace().getId(), s);
        }
        long collectedCount = userStamps.size();
        long totalCount = places.size();
        int percent = totalCount == 0 ? 0 : (int) Math.round(100.0 * collectedCount / totalCount);

        List<ContentSpotDto> spots = places.stream().map(p -> {
            Stamp s = stampByPlaceId.get(p.getId());
            return ContentSpotDto.builder()
                    .placeId(p.getId())
                    .name(p.getName())
                    .regionShort(shortenRegion(p.getRegionLabel()))
                    .coverImageUrls(p.getCoverImages().stream().map(PlaceCoverImage::getImageUrl).toList())
                    .scenes(p.getSceneImages().stream().map(PlaceSceneDto::from).toList())
                    .visited(s != null)
                    .visitedAt(s == null ? null : s.getAcquiredAt())
                    .orderIndex(p.getId())
                    .latitude(p.getLatitude())
                    .longitude(p.getLongitude())
                    .build();
        }).toList();

        ContentProgressSummaryDto progress = ContentProgressSummaryDto.builder()
                .collectedCount(collectedCount)
                .totalCount(totalCount)
                .percent(percent)
                .nextBadgeText(nextBadgeText(contentId, collectedCount, totalCount))
                .build();

        return ContentDetailResponse.builder()
                .content(ContentDetailDto.from(work))
                .progress(progress)
                .spots(spots)
                .build();
    }

    private String nextBadgeText(Long contentId, long collected, long total) {
        if (collected >= total) return null;
        return badgeRepository.findAllByOrderByOrderIndexAsc().stream()
                .filter(b -> b.getConditionType() == BadgeConditionType.WORK_COMPLETE)
                .filter(b -> contentId.equals(b.getConditionWorkId()))
                .findFirst()
                .map((Badge b) -> (total - collected) + "곳 더 모으면 " + b.getName() + " 뱃지")
                .orElse(null);
    }

    private String shortenRegion(String regionLabel) {
        if (regionLabel == null || regionLabel.isBlank()) return "";
        String[] parts = regionLabel.trim().split("\\s+");
        String last = parts[parts.length - 1];
        if (last.endsWith("읍") || last.endsWith("면") || last.endsWith("동")) {
            return last.substring(0, last.length() - 1);
        }
        return last;
    }
}
