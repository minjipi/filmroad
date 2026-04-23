package com.filmroad.api.domain.like.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LikeToggleResponse {
    private boolean liked;
    private int likeCount;
}
