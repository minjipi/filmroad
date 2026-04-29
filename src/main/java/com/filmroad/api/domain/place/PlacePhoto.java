package com.filmroad.api.domain.place;

import com.filmroad.api.common.model.BaseEntity;
import com.filmroad.api.domain.user.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * 인증샷 post — 한 번의 업로드 = 1 row. 첨부 이미지(1~5장) 는 별도 `PlacePhotoImage` 에 매달림.
 * caption / tags / visibility / likeCount / commentCount 등 post 메타는 여기에 한 번만 저장.
 */
@Getter
@Entity
@Table(name = "place_photo", indexes = @Index(name = "idx_place_photo_place", columnList = "place_id"))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class PlacePhoto extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "place_id", nullable = false)
    private Place place;

    @Column(name = "author_nickname", length = 60)
    private String authorNickname;

    @Column(name = "order_index", nullable = false, columnDefinition = "INT DEFAULT 0")
    private int orderIndex;

    @Column(name = "caption", length = 1000)
    private String caption;

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility", nullable = false, length = 20, columnDefinition = "VARCHAR(20) DEFAULT 'PUBLIC'")
    private PhotoVisibility visibility;

    @Column(name = "tags_csv", length = 500)
    private String tagsCsv;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "like_count", nullable = false, columnDefinition = "INT DEFAULT 0")
    private int likeCount;

    @Column(name = "comment_count", nullable = false, columnDefinition = "INT DEFAULT 0")
    private int commentCount;

    /**
     * 인증샷 채점 — 0~100. 가이드 사진 유사도 + 성지 GPS 근접도를 합산한 종합 점수.
     * 업로드 시 채점 서비스가 산출해 저장하며, 기본값 0(미채점) 으로 시작.
     */
    @Column(name = "total_score", nullable = false, columnDefinition = "INT DEFAULT 0")
    private int totalScore;

    /**
     * 가이드(scene) 사진과 업로드 사진의 시각적 유사도 점수 — 0~100.
     */
    @Column(name = "similarity_score", nullable = false, columnDefinition = "INT DEFAULT 0")
    private int similarityScore;

    /**
     * 성지 등록 GPS 와 촬영 GPS 의 근접도 점수 — 0~100. 거리가 가까울수록 높음.
     */
    @Column(name = "gps_score", nullable = false, columnDefinition = "INT DEFAULT 0")
    private int gpsScore;

    /**
     * 촬영 위도. 업로드 시 디바이스 GPS / 메타데이터에서 받음. null 가능(권한 미허용 등).
     */
    @Column(name = "captured_latitude")
    private Double capturedLatitude;

    /**
     * 촬영 경도. 업로드 시 디바이스 GPS / 메타데이터에서 받음. null 가능(권한 미허용 등).
     */
    @Column(name = "captured_longitude")
    private Double capturedLongitude;

    /**
     * 첨부 이미지 — `imageOrderIndex` ASC 순. cascade ALL + orphanRemoval 로 PlacePhoto 와 함께 생/삭.
     */
    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("imageOrderIndex ASC")
    @Builder.Default
    private List<PlacePhotoImage> images = new ArrayList<>();

    /**
     * 양방향 연결 헬퍼. 외부 코드는 항상 이걸로 image 를 연결해 인덱스/FK 정합성 보장.
     */
    public void addImage(PlacePhotoImage image) {
        this.images.add(image);
        image.attachToPost(this);
    }

    public void applyLikeDelta(int delta) {
        this.likeCount = Math.max(0, this.likeCount + delta);
    }

    public void applyCommentDelta(int delta) {
        this.commentCount = Math.max(0, this.commentCount + delta);
    }

    /**
     * 채점 결과 일괄 적용. 점수 산출 서비스가 (similarity, gps, total) 을 한 번에 세팅.
     * 0~100 범위는 호출자(서비스) 책임 — 엔티티는 그대로 저장.
     */
    public void applyScores(int similarityScore, int gpsScore, int totalScore) {
        this.similarityScore = similarityScore;
        this.gpsScore = gpsScore;
        this.totalScore = totalScore;
    }

    /**
     * 촬영 GPS 좌표 세팅. null 허용.
     */
    public void setCapturedCoordinates(Double latitude, Double longitude) {
        this.capturedLatitude = latitude;
        this.capturedLongitude = longitude;
    }

    /**
     * 작성자가 ShotDetail 메뉴에서 caption / 공개범위만 수정. 이미지 / 점수 /
     * 위치 / 작성자 같은 다른 메타는 업로드 당시 값 유지가 원칙이라 이 헬퍼는
     * 두 필드만 건드린다.
     */
    public void updateContent(String caption, PhotoVisibility visibility) {
        this.caption = caption;
        if (visibility != null) {
            this.visibility = visibility;
        }
    }

    /**
     * 대표 이미지 URL — 목록 카드 / signature 응답에서 사용. images 가 비어 있으면 null.
     */
    public String getPrimaryImageUrl() {
        return images == null || images.isEmpty() ? null : images.get(0).getImageUrl();
    }
}
