package com.filmroad.api.domain.user.dto;

import com.filmroad.api.domain.place.PhotoVisibility;
import com.filmroad.api.domain.place.PlacePhoto;
import lombok.Builder;
import lombok.Getter;

import java.util.Date;

/**
 * `GET /api/users/me/photos` 응답의 photo 단건. ProfilePage 인증샷 grid 에 필요한 필드 + 딥링크 key.
 */
@Getter
@Builder
public class MyPhotoDto {
    private Long id;
    private String imageUrl;
    private String caption;
    private Long placeId;
    private String placeName;
    private String regionLabel;
    private Long workId;
    private String workTitle;
    private PhotoVisibility visibility;
    private Date createdAt;

    public static MyPhotoDto from(PlacePhoto photo) {
        return MyPhotoDto.builder()
                .id(photo.getId())
                .imageUrl(photo.getPrimaryImageUrl())
                .caption(photo.getCaption())
                .placeId(photo.getPlace().getId())
                .placeName(photo.getPlace().getName())
                .regionLabel(photo.getPlace().getRegionLabel())
                .workId(photo.getPlace().getWork() == null ? null : photo.getPlace().getWork().getId())
                .workTitle(photo.getPlace().getWork() == null ? null : photo.getPlace().getWork().getTitle())
                .visibility(photo.getVisibility())
                .createdAt(photo.getCreatedAt())
                .build();
    }
}
