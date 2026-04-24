package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.comment.PostComment;
import lombok.Builder;
import lombok.Getter;

import java.util.Date;

/**
 * 사진 상세 헤더에 프리뷰되는 댓글. 현재 PostComment 엔티티에는 like/parent 정보가 없어
 * `likeCount=0, liked=false, parentId=null` 로 내려가지만, 프론트 렌더링 shape 은 유지.
 */
@Getter
@Builder
public class PhotoDetailCommentDto {
    private Long id;
    private String content;
    private Date createdAt;
    private PhotoDetailAuthorDto author;
    private int likeCount;
    private boolean liked;
    private Long parentId;

    public static PhotoDetailCommentDto from(PostComment comment, Long viewerId) {
        return PhotoDetailCommentDto.builder()
                .id(comment.getId())
                .content(comment.getContent())
                .createdAt(comment.getCreatedAt())
                .author(PhotoDetailAuthorDto.of(comment.getUser(), viewerId))
                .likeCount(0)
                .liked(false)
                .parentId(null)
                .build();
    }
}
