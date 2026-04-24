package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.place.PhotoVisibility;
import com.filmroad.api.domain.place.PlacePhoto;
import com.filmroad.api.domain.stamp.dto.RewardDeltaDto;
import com.filmroad.api.domain.stamp.dto.StampRewardDto;
import lombok.Builder;
import lombok.Getter;

import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Getter
@Builder
public class PhotoUploadResponse {
    private Long id;
    private String imageUrl;
    private Long placeId;
    private Long workId;
    private String workTitle;
    private String workEpisode;
    private String caption;
    private List<String> tags;
    private PhotoVisibility visibility;
    private Date createdAt;
    private StampRewardDto stamp;
    private RewardDeltaDto reward;
    /**
     * 같은 업로드 batch 의 사진 전체 (대표 사진 포함). 단일 업로드면 길이 1,
     * 멀티 업로드면 orderIndex 오름차순. 프론트는 이 배열로 carousel 구성.
     */
    private List<GroupPhotoSummary> groupPhotos;

    /**
     * `photos` 는 같은 batch 전체 (대표 = photos.get(0)) — orderIndex ASC 로 이미 정렬된 상태 가정.
     */
    public static PhotoUploadResponse of(List<PlacePhoto> photos, StampRewardDto stamp, RewardDeltaDto reward) {
        PlacePhoto primary = photos.get(0);
        return PhotoUploadResponse.builder()
                .id(primary.getId())
                .imageUrl(primary.getImageUrl())
                .placeId(primary.getPlace().getId())
                .workId(primary.getPlace().getWork().getId())
                .workTitle(primary.getPlace().getWork().getTitle())
                .workEpisode(primary.getPlace().getWorkEpisode())
                .caption(primary.getCaption())
                .tags(parseTags(primary.getTagsCsv()))
                .visibility(primary.getVisibility())
                .createdAt(primary.getCreatedAt())
                .stamp(stamp)
                .reward(reward)
                .groupPhotos(photos.stream().map(GroupPhotoSummary::from).toList())
                .build();
    }

    private static List<String> parseTags(String tagsCsv) {
        if (tagsCsv == null || tagsCsv.isBlank()) {
            return List.of();
        }
        return Arrays.stream(tagsCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }
}
