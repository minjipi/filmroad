package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.place.PlacePhoto;
import com.filmroad.api.domain.user.User;
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
     * (/user/:id) 로 라우팅할 때 사용. PlacePhoto.user 는 FK NOT NULL 이라
     * 정상 row 에선 항상 채워진다.
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

    /**
     * FeedService.resolveAuthor 와 같은 패턴 — 작성자 메타는 photo.user 에서 직접
     * 읽는다. (legacy column `author_nickname` 은 신규 업로드 시 null 로 저장되고
     * 사용자 닉네임 변경 시에도 갱신되지 않아 진실의 단일 소스가 못 됨.) handle
     * 은 DB 에 이미 `@miru` 형태로 저장되므로 추가 prefix 없이 그대로 노출.
     */
    public static GalleryPhotoDto from(PlacePhoto photo) {
        User u = photo.getUser();
        return GalleryPhotoDto.builder()
                .id(photo.getId())
                .imageUrl(photo.getPrimaryImageUrl())
                .caption(photo.getCaption())
                .authorUserId(u == null ? null : u.getId())
                .authorNickname(u == null ? null : u.getNickname())
                .authorHandle(u == null ? null : u.getHandle())
                .authorAvatarUrl(u == null ? null : u.getAvatarUrl())
                .authorVerified(u != null && u.isVerified())
                .likeCount(photo.getLikeCount())
                .commentCount(photo.getCommentCount())
                .createdAt(photo.getCreatedAt())
                .sceneCompare(false)
                .build();
    }
}
