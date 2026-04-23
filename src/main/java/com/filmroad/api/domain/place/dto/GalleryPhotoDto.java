package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.place.PlacePhoto;
import lombok.Builder;
import lombok.Getter;

import java.util.Date;

@Getter
@Builder
public class GalleryPhotoDto {
    private Long id;
    private String imageUrl;
    private String caption;
    private String authorNickname;
    private String authorHandle;
    private String authorAvatarUrl;
    private boolean authorVerified;
    private int likeCount;
    private int commentCount;
    private Date createdAt;
    private boolean sceneCompare;

    public static GalleryPhotoDto from(PlacePhoto photo) {
        String nickname = photo.getAuthorNickname();
        String handle = nickname == null || nickname.isBlank() ? null : "@" + nickname;
        return GalleryPhotoDto.builder()
                .id(photo.getId())
                .imageUrl(photo.getImageUrl())
                .caption(photo.getCaption())
                .authorNickname(nickname)
                .authorHandle(handle)
                .authorAvatarUrl(null)
                .authorVerified(false)
                .likeCount(photo.getLikeCount())
                .commentCount(photo.getCommentCount())
                .createdAt(photo.getCreatedAt())
                .sceneCompare(false)
                .build();
    }
}
