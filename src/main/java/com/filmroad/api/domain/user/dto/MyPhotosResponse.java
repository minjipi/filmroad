package com.filmroad.api.domain.user.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * `GET /api/users/me/photos` 응답 envelope. cursor 기반 페이지네이션.
 * `nextCursor` 가 null 이면 더 이상 페이지 없음, 값이 있으면 `?cursor=<값>` 으로 다음 페이지 요청.
 */
@Getter
@Builder
public class MyPhotosResponse {
    private List<MyPhotoDto> photos;
    private Long nextCursor;
}
