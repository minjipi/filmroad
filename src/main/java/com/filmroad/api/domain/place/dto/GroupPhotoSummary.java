package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.place.PlacePhoto;
import lombok.Builder;
import lombok.Getter;

/**
 * 같은 업로드 batch(`groupKey`) 에 속한 photo 최소 정보. ShotDetailPage carousel 이
 * 썸네일 전환용으로 사용. 대표 photo 의 place / work / author / caption / tags 등은
 * 부모 응답(`PhotoDetailResponse` / `PhotoUploadResponse`) 에서 한 번만 제공.
 */
@Getter
@Builder
public class GroupPhotoSummary {
    private Long id;
    private String imageUrl;
    private int orderIndex;

    public static GroupPhotoSummary from(PlacePhoto photo) {
        return GroupPhotoSummary.builder()
                .id(photo.getId())
                .imageUrl(photo.getImageUrl())
                .orderIndex(photo.getOrderIndex())
                .build();
    }
}
