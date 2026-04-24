package com.filmroad.api.domain.saved.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * `POST /api/saved/collections` 요청. 중복 이름 허용·유저당 최대 개수 제한 없음 (브리핑 #26).
 */
@Getter
@Setter
@NoArgsConstructor
public class CreateCollectionRequest {

    @NotBlank(message = "컬렉션 이름을 입력해주세요.")
    @Size(max = 60, message = "컬렉션 이름은 60자 이하로 입력해주세요.")
    private String name;
}
