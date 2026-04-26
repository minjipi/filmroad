package com.filmroad.api.domain.saved.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class CollectionSummaryDto {
    private Long id;
    private String name;
    private long count;
    private List<String> coverImageUrls;
    private String gradient;
}
