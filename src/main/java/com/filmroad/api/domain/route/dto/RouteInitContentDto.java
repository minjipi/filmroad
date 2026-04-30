package com.filmroad.api.domain.route.dto;

import com.filmroad.api.domain.content.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@Schema(description = "Route init: 기준 콘텐츠 요약")
public class RouteInitContentDto {

    private Long id;
    private String title;
    private String posterUrl;

    public static RouteInitContentDto from(Content c) {
        return RouteInitContentDto.builder()
                .id(c.getId())
                .title(c.getTitle())
                .posterUrl(c.getPosterUrl())
                .build();
    }
}
