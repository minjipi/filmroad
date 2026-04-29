package com.filmroad.api.domain.user.dto;

import com.filmroad.api.domain.place.PlacePhoto;
import lombok.Builder;
import lombok.Getter;

/**
 * 공개 프로필 `topPhotos` 엔트리 — 썸네일 grid 용 최소 필드.
 */
@Getter
@Builder
public class PublicPhotoDto {
    private Long id;
    private String imageUrl;
    private String contentTitle;
    private String placeName;

    public static PublicPhotoDto from(PlacePhoto photo) {
        String contentTitle = photo.getPlace() != null && photo.getPlace().getContent() != null
                ? photo.getPlace().getContent().getTitle()
                : null;
        String place = photo.getPlace() != null ? photo.getPlace().getName() : null;
        return PublicPhotoDto.builder()
                .id(photo.getId())
                .imageUrl(photo.getPrimaryImageUrl())
                .contentTitle(contentTitle)
                .placeName(place)
                .build();
    }
}
