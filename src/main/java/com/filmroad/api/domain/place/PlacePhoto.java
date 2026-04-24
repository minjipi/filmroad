package com.filmroad.api.domain.place;

import com.filmroad.api.common.model.BaseEntity;
import com.filmroad.api.domain.user.User;
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

    // 업로더. PhotoUploadService 에서 항상 현재 유저로 세팅. DB·JPA 양쪽 NOT NULL 로 강제해
    // "user_id 가 NULL 인 사진" 회귀를 재발 방지. (dev DB 에 기존 NULL row 가 있다면
    // ddl-auto=update 로 ALTER 할 때 실패할 수 있음 — 그 경우 아래 UPDATE 먼저 실행 필요:
    //   UPDATE place_photo SET user_id = 1 WHERE user_id IS NULL;)
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "like_count", nullable = false, columnDefinition = "INT DEFAULT 0")
    private int likeCount;

    @Column(name = "comment_count", nullable = false, columnDefinition = "INT DEFAULT 0")
    private int commentCount;

    public void applyLikeDelta(int delta) {
        this.likeCount = Math.max(0, this.likeCount + delta);
    }

    public void applyCommentDelta(int delta) {
        this.commentCount = Math.max(0, this.commentCount + delta);
    }
}
