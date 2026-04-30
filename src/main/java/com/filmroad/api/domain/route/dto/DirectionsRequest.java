package com.filmroad.api.domain.route.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * `POST /api/route/directions` 요청 바디.
 * waypoints 는 null 허용 (서비스에서 빈 리스트로 정규화), 최대 30개.
 */
@Getter
@Setter
@NoArgsConstructor
@Schema(description = "카카오 모빌리티 directions 프록시 요청")
public class DirectionsRequest {

    @NotNull(message = "origin 좌표가 필요합니다.")
    @Valid
    @Schema(description = "출발 좌표", requiredMode = Schema.RequiredMode.REQUIRED)
    private LatLngDto origin;

    @NotNull(message = "destination 좌표가 필요합니다.")
    @Valid
    @Schema(description = "도착 좌표", requiredMode = Schema.RequiredMode.REQUIRED)
    private LatLngDto destination;

    @Valid
    @Size(max = 30, message = "waypoints 는 최대 30개까지 가능합니다.")
    @Schema(description = "경유지 좌표 (null/빈 리스트 가능)")
    private List<LatLngDto> waypoints;
}
