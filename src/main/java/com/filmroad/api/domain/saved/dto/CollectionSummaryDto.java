package com.filmroad.api.domain.saved.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CollectionSummaryDto {
    private Long id;
    private String name;
    private long count;
    private String coverImageUrl;
    private String gradient;
}
