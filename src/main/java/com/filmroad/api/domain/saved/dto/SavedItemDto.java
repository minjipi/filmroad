package com.filmroad.api.domain.saved.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class SavedItemDto {
    private Long placeId;
    private String name;
    private String regionLabel;
    private String coverImageUrl;
    private Long workId;
    private String workTitle;
    private Double distanceKm;
    private int likeCount;
    private boolean visited;
    private Long collectionId;
}
