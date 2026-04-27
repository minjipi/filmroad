package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.place.PhotoVisibility;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PhotoUploadRequest {

    @NotNull
    private Long placeId;

    @Size(max = 1000)
    private String caption;

    private String tags;

    private PhotoVisibility visibility;

    private boolean addToStampbook;

    /**
     * 촬영 위도 — 디바이스 GPS / EXIF 에서 캡처한 값. 권한 거부 시 null 허용.
     * 서비스 단에서 성지 GPS 와 비교해 gpsScore 를 산출.
     */
    @DecimalMin(value = "-90.0")
    @DecimalMax(value = "90.0")
    private Double latitude;

    /**
     * 촬영 경도 — 디바이스 GPS / EXIF 에서 캡처한 값. 권한 거부 시 null 허용.
     */
    @DecimalMin(value = "-180.0")
    @DecimalMax(value = "180.0")
    private Double longitude;
}
