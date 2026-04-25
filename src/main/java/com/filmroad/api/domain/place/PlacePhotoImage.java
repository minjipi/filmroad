package com.filmroad.api.domain.place;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 인증샷 post(`PlacePhoto`) 의 첨부 이미지 1장. 한 post 에는 1~5장의 이미지가 매달릴 수 있고,
 * post 내부 순서는 `imageOrderIndex` (0..N-1) 로 정렬한다. caption / tags / visibility / like /
 * comment 같은 post 메타는 부모 PlacePhoto 한 곳에만 저장 — 이미지마다 중복되지 않음.
 */
@Getter
@Entity
@Table(name = "place_photo_image",
        indexes = @Index(name = "idx_place_photo_image_post", columnList = "place_photo_id, image_order_index"))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class PlacePhotoImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "place_photo_id", nullable = false)
    private PlacePhoto post;

    @Column(name = "image_url", nullable = false, length = 500)
    private String imageUrl;

    @Column(name = "image_order_index", nullable = false)
    private int imageOrderIndex;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }

    /**
     * 양방향 연결 — `PlacePhoto.addImage` 에서 호출. 외부 코드는 헬퍼 사용 권장.
     */
    void attachToPost(PlacePhoto post) {
        this.post = post;
    }
}
