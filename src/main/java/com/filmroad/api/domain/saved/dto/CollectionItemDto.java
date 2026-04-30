package com.filmroad.api.domain.saved.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.Date;

/**
 * 컬렉션 상세(#30)의 place item — `upcomingPlaces` / `visitedPlacesList` 양쪽에서 같은 shape.
 * `orderIndex` 는 route 순서(1-based, 트립 루트 reorder 결과 반영).
 * `contentEpisode` 는 "1회 00:15:24" 처럼 ep + timestamp 합성.
 * `userNote` 는 트립 루트의 장소별 사용자 메모 (없으면 null).
 */
@Getter
@Builder
public class CollectionItemDto {
    private Long id;                  // placeId — 프론트에서 place detail 이동 key
    private int orderIndex;
    private String name;
    private String regionLabel;
    private String coverImageUrl;
    private Double latitude;
    private Double longitude;

    private Long contentId;
    private String contentTitle;
    private String contentEpisode;       // 예: "1회 00:15:24" — episode 라벨 + scene timestamp 결합

    private int likeCount;
    private int photoCount;
    private Double distanceKm;

    private boolean visited;
    private Date visitedAt;
    private boolean certified;

    /** 트립 루트 장소별 사용자 메모. 없으면 null. */
    private String userNote;
}
