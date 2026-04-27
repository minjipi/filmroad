package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.place.PhotoVisibility;
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
     * 범위([-90, 90]) 밖 값은 서비스 단에서 null 로 정규화 + gpsScore=0 으로 처리하여
     * 업로드 자체는 통과 (정책 (b)). 따라서 여기서는 strict bean validation 을 걸지 않는다.
     */
    private Double latitude;

    /**
     * 촬영 경도 — 디바이스 GPS / EXIF 에서 캡처한 값. 권한 거부 시 null 허용.
     * 범위([-180, 180]) 밖 값은 서비스 단에서 null 로 정규화.
     */
    private Double longitude;
}
