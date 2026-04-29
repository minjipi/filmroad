package com.filmroad.api.domain.content.dto;

import com.filmroad.api.domain.content.Content;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ContentDetailDto {
    private Long id;
    private String title;
    private String subtitle;
    private String synopsis;
    private String posterUrl;
    private String coverUrl;
    private String kind;
    private Integer yearStart;
    private Integer episodeCount;
    private String network;
    private double ratingAverage;

    public static ContentDetailDto from(Content content) {
        return ContentDetailDto.builder()
                .id(content.getId())
                .title(content.getTitle())
                .subtitle(content.getSubtitle())
                .synopsis(content.getSynopsis())
                .posterUrl(content.getPosterUrl())
                .coverUrl(content.getPosterUrl())
                .kind(content.getType() == null ? null : content.getType().name())
                .yearStart(content.getYearStart())
                .episodeCount(content.getEpisodeCount())
                .network(content.getNetwork())
                .ratingAverage(content.getRatingAverage())
                .build();
    }
}
