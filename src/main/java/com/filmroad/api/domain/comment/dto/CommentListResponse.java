package com.filmroad.api.domain.comment.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class CommentListResponse {
    private List<CommentDto> comments;
    private boolean hasMore;
    private Long nextCursor;
}
