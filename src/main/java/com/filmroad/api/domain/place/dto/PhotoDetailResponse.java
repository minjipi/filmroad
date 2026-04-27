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
    private String sceneImageUrl;           // 작품 원본 씬 이미지 (place 에 저장, null 가능)
    private String caption;
    private List<String> tags;
    private PhotoVisibility visibility;
    private Date createdAt;

    private int likeCount;
    private int commentCount;
    private boolean liked;                  // viewer 가 좋아요 눌렀는지
    private boolean saved;                  // place 를 저장했는지 (북마크)

    /** 종합 채점 점수 0~100 — similarity + gps 합산. 미채점이면 0. */
    private int totalScore;
    /** 가이드 사진 vs 업로드 사진 유사도 0~100. */
    private int similarityScore;
    /** 성지 GPS 와 촬영 GPS 근접도 0~100. */
    private int gpsScore;
    /** 촬영 위도 — null 가능. */
    private Double capturedLatitude;
    /** 촬영 경도 — null 가능. */
    private Double capturedLongitude;

    private PhotoDetailAuthorDto author;
    private PhotoDetailPlaceDto place;
    private PhotoDetailWorkDto work;

    private List<PhotoDetailCommentDto> topComments;  // 상위 3개
    private int moreCommentsCount;                    // commentCount - topComments.size()

    /**
     * 첨부 이미지 — `imageOrderIndex` ASC. 단일 업로드면 길이 1.
     * 프론트 carousel 은 이 배열의 길이 > 1 일 때 indicator/슬라이드 노출.
     */
    private List<PhotoImageSummary> images;
}
