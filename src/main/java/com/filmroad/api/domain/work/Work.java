package com.filmroad.api.domain.work;

import com.filmroad.api.common.model.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "work")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Work extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(name = "poster_url", length = 500)
    private String posterUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private WorkType type;

    @Column(length = 80)
    private String subtitle;

    @Column(length = 500)
    private String synopsis;

    @Column(name = "rating_average", nullable = false, columnDefinition = "DOUBLE DEFAULT 0")
    private double ratingAverage;

    @Column(name = "year_start")
    private Integer yearStart;

    @Column(name = "episode_count")
    private Integer episodeCount;

    @Column(length = 40)
    private String network;
}
