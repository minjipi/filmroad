package com.filmroad.api.domain.comment.dto;

import com.filmroad.api.domain.comment.PostComment;
import lombok.Builder;
import lombok.Getter;

import java.util.Date;

@Getter
@Builder
public class CommentDto {
    private Long id;
    private String content;
    /** 인증샷 댓글 이미지 URL. 첨부 없으면 null. */
    private String imageUrl;
    private Date createdAt;
    private CommentAuthorDto author;

    public static CommentDto from(PostComment comment) {
        return CommentDto.builder()
                .id(comment.getId())
                .content(comment.getContent())
                .imageUrl(comment.getImageUrl())
                .createdAt(comment.getCreatedAt())
                .author(CommentAuthorDto.from(comment.getUser()))
                .build();
    }
}
