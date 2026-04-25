package com.filmroad.api.domain.saved.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * `PATCH /api/saved/collections/{id}` 요청. 현재는 name 만 변경 가능.
 */
@Getter
@Setter
@NoArgsConstructor
public class RenameCollectionRequest {

    @NotBlank(message = "컬렉션 이름을 입력해주세요.")
    @Size(max = 20, message = "컬렉션 이름은 20자 이하로 입력해주세요.")
    private String name;
}
