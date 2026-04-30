package com.filmroad.api.domain.saved.dto;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * `PATCH /api/saved/collections/{id}/places/{placeId}/note` 요청. userNote 를 새 값으로 갱신.
 * `null` 또는 빈 문자열은 메모 clear 로 동일 취급. 길이 상한 500 자.
 */
@Getter
@Setter
@NoArgsConstructor
public class UpdatePlaceNoteRequest {

    @Size(max = 500, message = "메모는 500자 이하로 입력해주세요.")
    private String userNote;
}
