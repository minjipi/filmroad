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

    public static ContentDetailDto from(Content work) {
        return ContentDetailDto.builder()
                .id(work.getId())
                .title(work.getTitle())
                .subtitle(work.getSubtitle())
                .synopsis(work.getSynopsis())
                .posterUrl(work.getPosterUrl())
                .coverUrl(work.getPosterUrl())
                .kind(work.getType() == null ? null : work.getType().name())
                .yearStart(work.getYearStart())
                .episodeCount(work.getEpisodeCount())
                .network(work.getNetwork())
                .ratingAverage(work.getRatingAverage())
                .build();
    }
}
