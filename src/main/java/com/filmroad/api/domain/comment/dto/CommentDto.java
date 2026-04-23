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
    private Date createdAt;
    private CommentAuthorDto author;

    public static CommentDto from(PostComment comment) {
        return CommentDto.builder()
                .id(comment.getId())
                .content(comment.getContent())
                .createdAt(comment.getCreatedAt())
                .author(CommentAuthorDto.from(comment.getUser()))
                .build();
    }
}
