package com.filmroad.api.domain.user.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MiniMapPinDto {
    private Double latitude;
    private Double longitude;
    private String variant;
}
