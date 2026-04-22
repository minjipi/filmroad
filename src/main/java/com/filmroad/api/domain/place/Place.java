package com.filmroad.api.domain.place;

import com.filmroad.api.common.model.BaseEntity;
import com.filmroad.api.domain.work.Work;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "place")
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

    @Column(name = "cover_image_url", length = 500)
    private String coverImageUrl;

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
}
