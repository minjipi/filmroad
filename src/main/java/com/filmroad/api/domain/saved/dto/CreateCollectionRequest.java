package com.filmroad.api.domain.saved.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * `POST /api/saved/collections` 요청. 중복 이름 허용·유저당 최대 개수 제한 없음 (브리핑 #26).
 *
 * 트립 루트 (#6) 확장: `description` (subtitle 으로 노출) 과 `placeIds` (생성과 동시에 N 개 장소 add) 를
 * 옵셔널로 받는다. placeIds 는 입력 순서가 곧 초기 orderIndex (0..N-1).
 */
@Getter
@Setter
@NoArgsConstructor
public class CreateCollectionRequest {

    @NotBlank(message = "컬렉션 이름을 입력해주세요.")
    @Size(max = 20, message = "컬렉션 이름은 20자 이하로 입력해주세요.")
    private String name;

    @Size(max = 200, message = "설명은 200자 이하로 입력해주세요.")
    private String description;

    /** 생성과 함께 컬렉션에 넣을 place ID 목록. null 또는 빈 리스트면 빈 컬렉션 생성. 입력 순서가 곧 정렬 순서. */
    private List<Long> placeIds;
}
