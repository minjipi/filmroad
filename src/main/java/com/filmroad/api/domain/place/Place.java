package com.filmroad.api.domain.place;

import com.filmroad.api.common.model.BaseEntity;
import com.filmroad.api.domain.work.Work;
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
        @Index(name = "idx_place_work", columnList = "work_id")
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

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "work_id", nullable = false)
    private Work work;

    @Column(name = "trending_score", nullable = false)
    private int trendingScore;

    @Column(name = "photo_count", nullable = false, columnDefinition = "INT DEFAULT 0")
    private int photoCount;

    @Column(name = "like_count", nullable = false, columnDefinition = "INT DEFAULT 0")
    private int likeCount;

    @Column(name = "rating", nullable = false, columnDefinition = "DOUBLE DEFAULT 0")
    private double rating;

    @Column(name = "work_episode", length = 40)
    private String workEpisode;

    @Column(name = "scene_timestamp", length = 20)
    private String sceneTimestamp;

    @Column(name = "scene_image_url", length = 500)
    private String sceneImageUrl;

    @Column(name = "scene_description", length = 1000)
    private String sceneDescription;

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
}
