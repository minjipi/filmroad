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
     * 대표 이미지 URL — 목록 카드 / signature 응답에서 사용. images 가 비어 있으면 null.
     */
    public String getPrimaryImageUrl() {
        return images == null || images.isEmpty() ? null : images.get(0).getImageUrl();
    }
}
