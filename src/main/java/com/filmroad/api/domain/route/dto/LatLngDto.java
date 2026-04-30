package com.filmroad.api.domain.route.dto;

import com.filmroad.api.integration.kakao.KakaoMobilityClient;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 위도/경도 좌표쌍 DTO. 요청/응답 양쪽에서 재사용.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "위도/경도 좌표")
public class LatLngDto {

    @NotNull(message = "lat 값이 필요합니다.")
    @DecimalMin(value = "-90.0", message = "lat 값이 위도 범위를 벗어났습니다.")
    @DecimalMax(value = "90.0", message = "lat 값이 위도 범위를 벗어났습니다.")
    @Schema(description = "위도", example = "37.5665")
    private Double lat;

    @NotNull(message = "lng 값이 필요합니다.")
    @DecimalMin(value = "-180.0", message = "lng 값이 경도 범위를 벗어났습니다.")
    @DecimalMax(value = "180.0", message = "lng 값이 경도 범위를 벗어났습니다.")
    @Schema(description = "경도", example = "126.9780")
    private Double lng;

    public KakaoMobilityClient.LatLng toClientCoord() {
        return new KakaoMobilityClient.LatLng(lat, lng);
    }

    public static LatLngDto from(KakaoMobilityClient.LatLng coord) {
        return new LatLngDto(coord.lat(), coord.lng());
    }
}
