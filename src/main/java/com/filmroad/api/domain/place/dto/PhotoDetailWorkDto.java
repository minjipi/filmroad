package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.work.Work;
import com.filmroad.api.domain.work.WorkType;
import lombok.Builder;
import lombok.Getter;

/**
 * 사진이 찍힌 작품·회차·씬 타임스탬프 묶음. `episode` / `sceneTimestamp` 는 place 의
 * 대표(primary, 0번) PlaceSceneImage 에서 폴백 — 메타가 1:N 으로 분리되며 요약 카드에는
 * 대표 1건만 노출하기 위함. 상세에서 전체 회차/씬 보고 싶으면 `scenes` 리스트를 사용.
 */
@Getter
@Builder
public class PhotoDetailWorkDto {
    private Long id;
    private String title;
    private WorkType type;
    private String posterUrl;
    private String network;
    private String episode;
    private String sceneTimestamp;

    public static PhotoDetailWorkDto of(Work work, Place place) {
        if (work == null) return null;
        return PhotoDetailWorkDto.builder()
                .id(work.getId())
                .title(work.getTitle())
                .type(work.getType())
                .posterUrl(work.getPosterUrl())
                .network(work.getNetwork())
                .episode(place == null ? null : place.getPrimaryWorkEpisode())
                .sceneTimestamp(place == null ? null : place.getPrimarySceneTimestamp())
                .build();
    }
}
