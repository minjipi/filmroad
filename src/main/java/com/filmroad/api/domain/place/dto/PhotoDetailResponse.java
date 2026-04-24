package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.place.PhotoVisibility;
import lombok.Builder;
import lombok.Getter;

import java.util.Date;
import java.util.List;

/**
 * `GET /api/photos/:id` 응답. ShotDetailPage(15-shot-detail.html) 의 hero(scene vs user 이미지) /
 * action bar / caption / tags / top comments preview 블록을 한 번에 공급.
 */
@Getter
@Builder
public class PhotoDetailResponse {
    private Long id;
    private String imageUrl;                // 유저 업로드 사진
    private String dramaSceneImageUrl;      // 작품 원본 씬 이미지 (place 에 저장, null 가능)
    private String caption;
    private List<String> tags;
    private PhotoVisibility visibility;
    private Date createdAt;

    private int likeCount;
    private int commentCount;
    private boolean liked;                  // viewer 가 좋아요 눌렀는지
    private boolean saved;                  // place 를 저장했는지 (북마크)

    private PhotoDetailAuthorDto author;
    private PhotoDetailPlaceDto place;
    private PhotoDetailWorkDto work;

    private List<PhotoDetailCommentDto> topComments;  // 상위 3개
    private int moreCommentsCount;                    // commentCount - topComments.size()
}
