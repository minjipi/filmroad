package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.place.PhotoVisibility;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 인증샷 수정 요청 — 작성자가 ShotDetail 더보기 메뉴의 "수정" 으로 caption /
 * 공개범위 만 변경할 수 있도록 한 좁은 페이로드. 이미지 / 위치 / 점수는
 * 업로드 당시의 값을 그대로 유지하며 수정 대상이 아니다.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PhotoUpdateRequest {

    /** 캡션 — 빈 값(null/빈 문자열) 허용. 1000자 상한. */
    @Size(max = 1000)
    private String caption;

    /** 공개범위 — PUBLIC / FOLLOWERS / PRIVATE 중 필수. */
    @NotNull
    private PhotoVisibility visibility;
}
