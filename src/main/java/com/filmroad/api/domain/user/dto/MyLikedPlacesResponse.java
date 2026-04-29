package com.filmroad.api.domain.user.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * `GET /api/users/me/liked-places` 응답 envelope. cursor 기반 페이지네이션.
 * `nextCursor` 가 null 이면 마지막 페이지. cursor 는 PlaceLike row id (좋아요 시점의 PK).
 */
@Getter
@Builder
public class MyLikedPlacesResponse {
    private List<LikedPlaceDto> places;
    private Long nextCursor;
}
