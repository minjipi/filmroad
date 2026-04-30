package com.filmroad.api.domain.content.dto;

import com.filmroad.api.domain.place.dto.PlaceSceneDto;
import lombok.Builder;
import lombok.Getter;

import java.util.Date;
import java.util.List;

@Getter
@Builder
public class ContentSpotDto {
    private Long placeId;
    private String name;
    private String regionShort;
    private String regionLabel;
    private String address;
    private List<String> coverImageUrls;
    /**
     * 작품 씬 목록 — `imageOrderIndex` ASC. 회차/타임스탬프/설명/이미지URL 4종 모두 PlaceSceneDto 안.
     * 빈 리스트 가능. ContentDetailPage 의 spot card carousel 에 그대로 매핑.
     */
    private List<PlaceSceneDto> scenes;
    private boolean visited;
    private Date visitedAt;
    private Long orderIndex;
    private Double latitude;
    private Double longitude;
}
