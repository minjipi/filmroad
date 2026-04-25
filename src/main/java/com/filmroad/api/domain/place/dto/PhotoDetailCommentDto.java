package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.comment.PostComment;
import lombok.Builder;
import lombok.Getter;

import java.util.Date;

/**
 * 사진 상세 상단에 프리뷰되는 댓글. 프론트 `ShotDetailPage` 가 flat shape 을 쓰므로 author 는 nested 하지 않고
 * `authorHandle` / `authorAvatarUrl` 로 펼침. 현재 PostComment 엔티티에는 like / parent 관계가 없어
 * `likeCount=0, liked=false, isReply=false` 로 내려가지만 프론트 shape 은 유지.
 */
@Getter
@Builder
public class PhotoDetailCommentDto {
    private Long id;
    private String content;
    private Date createdAt;
    private String authorHandle;
    private String authorAvatarUrl;
    private int likeCount;
    private boolean liked;
    private boolean isReply;

    public static PhotoDetailCommentDto from(PostComment comment) {
        String handle = comment.getUser() != null ? comment.getUser().getHandle() : null;
        String avatar = comment.getUser() != null ? comment.getUser().getAvatarUrl() : null;
        return PhotoDetailCommentDto.builder()
                .id(comment.getId())
                .content(comment.getContent())
                .createdAt(comment.getCreatedAt())
                .authorHandle(handle)
                .authorAvatarUrl(avatar)
                .likeCount(0)
                .liked(false)
                .isReply(false)
                .build();
    }
}
