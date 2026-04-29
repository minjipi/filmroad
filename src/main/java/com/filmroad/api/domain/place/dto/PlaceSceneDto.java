package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.place.PlaceSceneImage;
import lombok.Builder;
import lombok.Getter;

/**
 * Place 씬(scene) 1건의 응답 페이로드. PlaceFullDto / PhotoDetailResponse / WorkSpotDto 의
 * `scenes: List<PlaceSceneDto>` 항목으로 노출되며, `imageOrderIndex` ASC 로 정렬된 상태로 내려간다.
 * 0 번이 대표(primary) — 요약 DTO 의 평면 필드 폴백, ShotScoringService 의 비교 기준과 일치.
 */
@Getter
@Builder
public class PlaceSceneDto {
    private Long id;
    private String imageUrl;
    private String workEpisode;
    private String sceneTimestamp;
    private String sceneDescription;
    private int orderIndex;

    public static PlaceSceneDto from(PlaceSceneImage scene) {
        return PlaceSceneDto.builder()
                .id(scene.getId())
                .imageUrl(scene.getImageUrl())
                .workEpisode(scene.getWorkEpisode())
                .sceneTimestamp(scene.getSceneTimestamp())
                .sceneDescription(scene.getSceneDescription())
                .orderIndex(scene.getImageOrderIndex())
                .build();
    }
}
