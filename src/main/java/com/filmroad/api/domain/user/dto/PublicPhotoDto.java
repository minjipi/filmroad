package com.filmroad.api.domain.user.dto;

import com.filmroad.api.domain.place.PlacePhoto;
import lombok.Builder;
import lombok.Getter;

/**
 * 공개 프로필 grid 썸네일. 작품 overlay (workTitle) + 좋아요 수만 frontend 에서 쓰므로 최소 필드.
 */
@Getter
@Builder
public class PublicPhotoDto {
    private Long id;
    private String imageUrl;
    private Long placeId;
    private String workTitle;
    private int likeCount;
    private boolean sceneCompare;   // place 에 sceneImageUrl 있으면 grid cell 에 "비교" 오버레이.

    public static PublicPhotoDto from(PlacePhoto photo) {
        boolean compare = photo.getPlace() != null && photo.getPlace().getSceneImageUrl() != null;
        return PublicPhotoDto.builder()
                .id(photo.getId())
                .imageUrl(photo.getImageUrl())
                .placeId(photo.getPlace() == null ? null : photo.getPlace().getId())
                .workTitle(photo.getPlace() == null || photo.getPlace().getWork() == null
                        ? null
                        : photo.getPlace().getWork().getTitle())
                .likeCount(photo.getLikeCount())
                .sceneCompare(compare)
                .build();
    }
}
