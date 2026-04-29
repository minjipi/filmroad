package com.filmroad.api.domain.place;

import com.filmroad.api.common.model.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Place 의 작품 장면(씬) 1건. 한 Place 는 여러 씬을 가질 수 있고, 정렬은 `imageOrderIndex` (0..N-1) 기준.
 * 0 번 인덱스가 대표(primary) — 상세 DTO 의 `scenes` 리스트 첫 항목, 그리고 요약 DTO(FeedContentDto 등) 의
 * 평면 필드 폴백, ShotScoringService 의 pHash 비교 기준이 모두 primary 를 본다.
 *
 * <h3>필드 의미</h3>
 * <ul>
 *   <li>{@code imageUrl} — 작품 원본 씬 이미지 URL (NOT NULL)</li>
 *   <li>{@code contentEpisode} — 회차 라벨 (예: "1회"). 같은 place 의 다른 씬이 다른 회차일 수 있어 컬렉션으로 분리.</li>
 *   <li>{@code sceneTimestamp} — 작품 내 타임스탬프 (예: "00:15:24"). 회차와 함께 씬 식별.</li>
 *   <li>{@code sceneDescription} — 씬 설명 본문. PlaceDetail 에서 carousel 슬라이드별 설명으로 노출.</li>
 * </ul>
 *
 * 모델링 패턴은 `PlaceCoverImage` / `PlacePhotoImage` 와 동일 — `@ManyToOne(LAZY)` 부모 참조 + `@OrderBy` 인덱스 정렬.
 */
@Getter
@Entity
@Table(name = "place_scene_image",
        indexes = @Index(name = "idx_place_scene_image_place", columnList = "place_id, image_order_index"))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class PlaceSceneImage extends BaseEntity {

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

    @Column(name = "content_episode", length = 40)
    private String contentEpisode;

    @Column(name = "scene_timestamp", length = 20)
    private String sceneTimestamp;

    @Column(name = "scene_description", length = 1000)
    private String sceneDescription;

    /**
     * 양방향 연결 — `Place.addSceneImage` 에서 호출. 외부 코드는 헬퍼 사용 권장.
     */
    void attachToPlace(Place place) {
        this.place = place;
    }
}
