package com.filmroad.api.domain.saved.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ToggleSaveResponse {
    private boolean saved;
    private long totalCount;
}
