package com.filmroad.api.domain.saved.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * `POST /api/saved/collections/{id}/places` 요청. 컬렉션 끝(orderIndex max+1) 에 장소 1건을 추가.
 * 같은 user 의 SavedPlace 가 이미 다른 collection 에 있으면 새 collection 으로 이동(이전 위치 비움).
 */
@Getter
@Setter
@NoArgsConstructor
public class AddPlaceToCollectionRequest {

    @NotNull(message = "placeId 는 필수입니다.")
    private Long placeId;

    @Size(max = 500, message = "메모는 500자 이하로 입력해주세요.")
    private String userNote;
}
