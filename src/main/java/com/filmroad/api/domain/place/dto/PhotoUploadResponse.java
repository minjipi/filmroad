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
    /** 대표 이미지 — `images.get(0).getImageUrl()`. images 비어 있으면 null. */
    private String imageUrl;
    private Long placeId;
    private Long contentId;
    private String contentTitle;
    private String contentEpisode;
    private String caption;
    private List<String> tags;
    private PhotoVisibility visibility;
    private Date createdAt;
    /** 종합 채점 점수 0~100 — similarity + gps 합산. 미채점이면 0. */
    private int totalScore;
    /** 가이드 사진 vs 업로드 사진 유사도 0~100. */
    private int similarityScore;
    /** 성지 GPS 와 촬영 GPS 근접도 0~100. */
    private int gpsScore;
    /** 촬영 위도 — 클라이언트에서 보낸 값을 그대로 echo. null 가능. */
    private Double capturedLatitude;
    /** 촬영 경도 — 클라이언트에서 보낸 값을 그대로 echo. null 가능. */
    private Double capturedLongitude;
    private StampRewardDto stamp;
    private RewardDeltaDto reward;
    /**
     * 첨부 이미지 전체 (대표 포함). 단일 업로드면 길이 1, 멀티 업로드면 imageOrderIndex 오름차순.
     */
    private List<PhotoImageSummary> images;

    public static PhotoUploadResponse of(PlacePhoto post, StampRewardDto stamp, RewardDeltaDto reward) {
        return PhotoUploadResponse.builder()
                .id(post.getId())
                .imageUrl(post.getPrimaryImageUrl())
                .placeId(post.getPlace().getId())
                .contentId(post.getPlace().getContent().getId())
                .contentTitle(post.getPlace().getContent().getTitle())
                .contentEpisode(post.getPlace().getPrimaryWorkEpisode())
                .caption(post.getCaption())
                .tags(parseTags(post.getTagsCsv()))
                .visibility(post.getVisibility())
                .createdAt(post.getCreatedAt())
                .totalScore(post.getTotalScore())
                .similarityScore(post.getSimilarityScore())
                .gpsScore(post.getGpsScore())
                .capturedLatitude(post.getCapturedLatitude())
                .capturedLongitude(post.getCapturedLongitude())
                .stamp(stamp)
                .reward(reward)
                .images(post.getImages().stream().map(PhotoImageSummary::from).toList())
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
