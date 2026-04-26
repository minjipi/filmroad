package com.filmroad.api.domain.saved.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class SavedItemDto {
    private Long placeId;
    private String name;
    private String regionLabel;
    private List<String> coverImageUrls;
    private Long workId;
    private String workTitle;
    private Double distanceKm;
    private int likeCount;
    private boolean visited;
    private Long collectionId;
}
