package com.filmroad.api.domain.place;

import com.filmroad.api.common.model.BaseEntity;
import com.filmroad.api.domain.content.Content;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Getter
@Entity
@Table(name = "place", indexes = {
        @Index(name = "idx_place_lat_lng", columnList = "latitude, longitude"),
        @Index(name = "idx_place_content", columnList = "content_id")
})
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Place extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "region_label", nullable = false, length = 120)
    private String regionLabel;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    /**
     * 커버 이미지 — `imageOrderIndex` ASC 순. cascade ALL + orphanRemoval 로 Place 와 함께 생/삭.
     * 응답 DTO 에는 List<String> coverImageUrls 로 노출. 0 번이 대표(primary) 이미지.
     */
    @OneToMany(mappedBy = "place", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("imageOrderIndex ASC")
    @Builder.Default
    private List<PlaceCoverImage> coverImages = new ArrayList<>();

    /**
     * 작품 씬 이미지 — `imageOrderIndex` ASC 순. cascade ALL + orphanRemoval 로 Place 와 함께 생/삭.
     * 응답 DTO 에는 List<String> sceneImageUrls 로 노출. 0 번이 대표(primary) — 채점 비교 기준.
     */
    @OneToMany(mappedBy = "place", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("imageOrderIndex ASC")
    @Builder.Default
    private List<PlaceSceneImage> sceneImages = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "content_id", nullable = false)
    private Content work;

    @Column(name = "trending_score", nullable = false)
    private int trendingScore;

    @Column(name = "photo_count", nullable = false, columnDefinition = "INT DEFAULT 0")
    private int photoCount;

    @Column(name = "like_count", nullable = false, columnDefinition = "INT DEFAULT 0")
    private int likeCount;

    @Column(name = "rating", nullable = false, columnDefinition = "DOUBLE DEFAULT 0")
    private double rating;

    // contentEpisode / sceneTimestamp / sceneDescription / sceneImageUrl 4종은 모두
    // place_scene_image (1:N) 의 컬럼으로 이전됨. Place 에는 더 이상 보유하지 않는다.

    @Column(name = "nearby_restaurant_count", nullable = false, columnDefinition = "INT DEFAULT 0")
    private int nearbyRestaurantCount;

    @Column(name = "recommended_time_label", length = 40)
    private String recommendedTimeLabel;

    @Column(name = "review_count", nullable = false, columnDefinition = "INT DEFAULT 0")
    private int reviewCount;

    @Column(length = 200)
    private String address;

    @Column(name = "place_type", length = 40)
    private String placeType;

    @Column(length = 30)
    private String phone;

    @Column(name = "operating_hours", length = 100)
    private String operatingHours;

    public void applyLikeDelta(int delta) {
        this.likeCount = Math.max(0, this.likeCount + delta);
    }

    /**
     * 양방향 연결 헬퍼. 외부 코드는 항상 이걸로 cover image 를 연결해 인덱스/FK 정합성 보장.
     */
    public void addCoverImage(PlaceCoverImage image) {
        this.coverImages.add(image);
        image.attachToPlace(this);
    }

    /**
     * 대표 cover URL — 내부 fallback 용도. 외부 응답에는 List<String> coverImageUrls 로 노출하므로
     * 이 헬퍼는 단일 URL 이 필요한 도메인(예: Collection cover) 에서만 사용.
     */
    public String getPrimaryCoverImageUrl() {
        return coverImages == null || coverImages.isEmpty() ? null : coverImages.get(0).getImageUrl();
    }

    /**
     * 양방향 연결 헬퍼. 외부 코드는 항상 이걸로 scene image 를 연결해 인덱스/FK 정합성 보장.
     */
    public void addSceneImage(PlaceSceneImage image) {
        this.sceneImages.add(image);
        image.attachToPlace(this);
    }

    /**
     * 대표(0번) scene URL. 요약 DTO(FeedContentDto, PhotoUploadResponse 등) 가 평면 필드로 노출할 때,
     * 그리고 ShotScoringService 가 fallback 비교 기준이 필요할 때 사용. 상세 DTO 는 `scenes` 리스트
     * 전체를 노출하므로 이 헬퍼를 쓰지 말 것.
     */
    public String getPrimarySceneImageUrl() {
        return sceneImages == null || sceneImages.isEmpty() ? null : sceneImages.get(0).getImageUrl();
    }

    /** 대표(0번) contentEpisode — 요약 DTO 평면 필드 폴백용. 씬이 없으면 null. */
    public String getPrimaryContentEpisode() {
        return sceneImages == null || sceneImages.isEmpty() ? null : sceneImages.get(0).getContentEpisode();
    }

    /** 대표(0번) sceneTimestamp — 요약 DTO 평면 필드 폴백용. 씬이 없으면 null. */
    public String getPrimarySceneTimestamp() {
        return sceneImages == null || sceneImages.isEmpty() ? null : sceneImages.get(0).getSceneTimestamp();
    }

    /** 대표(0번) sceneDescription — 요약 DTO 평면 필드 폴백용. 씬이 없으면 null. */
    public String getPrimarySceneDescription() {
        return sceneImages == null || sceneImages.isEmpty() ? null : sceneImages.get(0).getSceneDescription();
    }
}
