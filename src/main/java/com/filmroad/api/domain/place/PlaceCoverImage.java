package com.filmroad.api.domain.place;

import com.filmroad.api.common.model.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Place 의 커버 이미지 1장. 한 Place 에는 여러 장의 cover image 가 매달릴 수 있고,
 * 정렬은 `imageOrderIndex` (0..N-1) 기준. 응답 DTO 에는 List<String> coverImageUrls 로 노출되며,
 * 0 번 인덱스가 대표(primary) 이미지로 fallback 사용된다.
 *
 * 모델링 패턴은 `PlacePhotoImage` 와 동일 — `@ManyToOne(LAZY)` 부모 참조 + `@OrderBy` 인덱스 정렬.
 */
@Getter
@Entity
@Table(name = "place_cover_image",
        indexes = @Index(name = "idx_place_cover_image_place", columnList = "place_id, image_order_index"))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class PlaceCoverImage extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "place_id", nullable = false)
    private Place place;

    @Column(name = "image_url", nullable = false, length = 500)
    private String imageUrl;

    @Column(name = "image_order_index", nullable = false)
    private int imageOrderIndex;

    /**
     * 양방향 연결 — `Place.addCoverImage` 에서 호출. 외부 코드는 헬퍼 사용 권장.
     */
    void attachToPlace(Place place) {
        this.place = place;
    }
}
