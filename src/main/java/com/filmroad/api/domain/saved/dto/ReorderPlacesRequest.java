package com.filmroad.api.domain.saved.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * `PATCH /api/saved/collections/{id}/order` 요청. 컬렉션 내 모든 SavedPlace 의 orderIndex 를
 * 입력 순서대로 0..N-1 로 일괄 갱신한다. 입력 placeIds 는 컬렉션의 현재 place 집합과 정확히 일치해야 함
 * (set 동등) — 누락/추가/중복은 400 으로 거부.
 */
@Getter
@Setter
@NoArgsConstructor
public class ReorderPlacesRequest {

    @NotEmpty(message = "placeIds 가 비어 있습니다.")
    private List<Long> placeIds;
}
