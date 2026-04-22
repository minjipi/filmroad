package com.filmroad.api.domain.place;

import com.filmroad.api.common.model.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

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

    @Column(name = "image_url", nullable = false, length = 500)
    private String imageUrl;

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
}
