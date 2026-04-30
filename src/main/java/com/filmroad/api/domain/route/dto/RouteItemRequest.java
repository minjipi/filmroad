package com.filmroad.api.domain.route.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Schema(description = "Route 항목 요청")
public class RouteItemRequest {

    @NotNull(message = "placeId 가 필요합니다.")
    @Schema(description = "Place.id", requiredMode = Schema.RequiredMode.REQUIRED)
    private Long placeId;

    @NotNull(message = "orderIndex 가 필요합니다.")
    @Min(value = 0, message = "orderIndex 는 0 이상이어야 합니다.")
    @Schema(description = "0..n-1 연속 정수")
    private Integer orderIndex;

    @NotNull(message = "durationMin 이 필요합니다.")
    @Min(value = 0, message = "durationMin 은 0 이상이어야 합니다.")
    @Schema(description = "체류 시간(분)")
    private Integer durationMin;

    @Size(max = 1000, message = "note 는 최대 1000자입니다.")
    @Schema(description = "사용자 메모", nullable = true)
    private String note;
}
