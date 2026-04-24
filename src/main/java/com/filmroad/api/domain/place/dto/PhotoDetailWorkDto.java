package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.work.Work;
import lombok.Builder;
import lombok.Getter;

/**
 * 사진이 찍힌 작품·회차·씬 타임스탬프 묶음. `episode` / `sceneTimestamp` 는 Place 에 저장된 메타 기준.
 */
@Getter
@Builder
public class PhotoDetailWorkDto {
    private Long id;
    private String title;
    private String network;
    private String episode;
    private String sceneTimestamp;

    public static PhotoDetailWorkDto of(Work work, Place place) {
        if (work == null) return null;
        return PhotoDetailWorkDto.builder()
                .id(work.getId())
                .title(work.getTitle())
                .network(work.getNetwork())
                .episode(place == null ? null : place.getWorkEpisode())
                .sceneTimestamp(place == null ? null : place.getSceneTimestamp())
                .build();
    }
}
