package com.filmroad.api.domain.saved.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ToggleSaveRequest {
    @NotNull
    private Long placeId;

    // 저장(save) 시 넣을 컬렉션. null 이면 기본(미할당). unsave 경로에서는 무시.
    private Long collectionId;
}
