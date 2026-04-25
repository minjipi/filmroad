package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.place.PlacePhoto;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PlacePhotoDto {
    private Long id;
    private String imageUrl;
    private String authorNickname;

    public static PlacePhotoDto from(PlacePhoto photo) {
        return PlacePhotoDto.builder()
                .id(photo.getId())
                .imageUrl(photo.getPrimaryImageUrl())
                .authorNickname(photo.getAuthorNickname())
                .build();
    }
}
