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

    public static PhotoUploadResponse of(PlacePhoto photo, StampRewardDto stamp, RewardDeltaDto reward) {
        return PhotoUploadResponse.builder()
                .id(photo.getId())
                .imageUrl(photo.getImageUrl())
                .placeId(photo.getPlace().getId())
                .workId(photo.getPlace().getWork().getId())
                .workTitle(photo.getPlace().getWork().getTitle())
                .workEpisode(photo.getPlace().getWorkEpisode())
                .caption(photo.getCaption())
                .tags(parseTags(photo.getTagsCsv()))
                .visibility(photo.getVisibility())
                .createdAt(photo.getCreatedAt())
                .stamp(stamp)
                .reward(reward)
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
