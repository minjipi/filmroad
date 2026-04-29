package com.filmroad.api.domain.saved.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.Date;
import java.util.List;

/**
 * `GET /api/saved/collections/:id` 응답 (#30, 16-collection-detail.html 1:1).
 * upcoming/visited 리스트를 서버에서 미리 분리해 내려보내 프론트 렌더링을 단순화.
 */
@Getter
@Builder
public class CollectionDetailResponse {
    private Long id;
    private String name;
    private String subtitle;              // Collection.description — 없으면 null
    private String coverImageUrl;         // cover_place_id 의 이미지 → fallback 으로 첫 place 의 커버
    private String kind;                  // "CONTENT" | "CUSTOM"
    private String contentTitle;             // kind==WORK 일 때만, 그 외 null
    private Date createdAt;

    private int totalPlaces;
    private int visitedPlaces;
    private int certifiedPlaces;

    private Double totalDistanceKm;       // 순서대로 이은 haversine 합 (nullable, 계산 불능 시 null)
    private Long likeCount;               // 현재는 컬렉션 자체 좋아요 트래킹 없음 → 수록 place.likeCount 합으로 근사

    private CollectionOwnerDto owner;
    private String privacy;               // "PRIVATE" — 현 단계 고정, 후속에서 PUBLIC 지원

    private List<CollectionItemDto> upcomingPlaces;      // visited=false
    private List<CollectionItemDto> visitedPlacesList;   // visited=true
}
