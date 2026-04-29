package com.filmroad.api.domain.feed.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.Date;

@Getter
@Builder
public class FeedPostDto {
    private Long id;
    private String imageUrl;
    private String caption;
    private Date createdAt;
    private boolean sceneCompare;
    private String dramaSceneImageUrl;
    private FeedAuthorDto author;
    private FeedPlaceDto place;
    private FeedContentDto content;
    private int likeCount;
    private int commentCount;
    private boolean liked;
    private boolean saved;
    private Date visitedAt;
}
