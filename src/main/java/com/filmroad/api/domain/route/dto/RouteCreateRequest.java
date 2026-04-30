package com.filmroad.api.domain.route.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Schema(description = "POST /api/route, PUT /api/route/{id} 요청")
public class RouteCreateRequest {

    @NotBlank(message = "name 이 필요합니다.")
    @Size(max = 120, message = "name 은 최대 120자입니다.")
    @Schema(description = "코스 이름", requiredMode = Schema.RequiredMode.REQUIRED)
    private String name;

    @NotBlank(message = "startTime 이 필요합니다.")
    @Pattern(regexp = "^([01][0-9]|2[0-3]):[0-5][0-9]$",
            message = "startTime 은 HH:mm 형식이어야 합니다.")
    @Schema(description = "출발 시각 (HH:mm)", requiredMode = Schema.RequiredMode.REQUIRED, example = "09:00")
    private String startTime;

    @Schema(description = "기준 콘텐츠 id (없으면 자유 코스)", nullable = true)
    private Long contentId;

    @NotEmpty(message = "items 가 비어있습니다.")
    @Size(max = 30, message = "items 는 최대 30개까지 가능합니다.")
    @Valid
    @Schema(description = "코스 항목 목록", requiredMode = Schema.RequiredMode.REQUIRED)
    private List<RouteItemRequest> items;
}
