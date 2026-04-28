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
    /**
     * 작성자 user 의 numeric id. 프런트가 갤러리에서 사진 작성자의 프로필
     * (/user/:id) 로 라우팅할 때 사용. anonymous 시드 사진처럼 user 가 없는
     * 케이스는 null — 클릭 자체를 disable 한다.
     */
    private Long authorUserId;
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
        Long authorUserId = photo.getUser() != null ? photo.getUser().getId() : null;
        return GalleryPhotoDto.builder()
                .id(photo.getId())
                .imageUrl(photo.getPrimaryImageUrl())
                .caption(photo.getCaption())
                .authorUserId(authorUserId)
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
