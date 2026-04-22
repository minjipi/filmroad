package com.filmroad.api.domain.saved.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class SavedResponse {
    private List<CollectionSummaryDto> collections;
    private long totalCount;
    private List<SavedItemDto> items;
    private RouteSuggestionDto nearbyRouteSuggestion;
}
