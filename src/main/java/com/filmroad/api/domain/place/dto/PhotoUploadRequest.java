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
}
