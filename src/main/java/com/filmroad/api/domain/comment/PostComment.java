package com.filmroad.api.domain.comment;

import com.filmroad.api.common.model.BaseEntity;
import com.filmroad.api.domain.place.PlacePhoto;
import com.filmroad.api.domain.user.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(
        name = "post_comment",
        indexes = {
                @Index(name = "idx_post_comment_photo", columnList = "photo_id, create_date"),
                @Index(name = "idx_post_comment_user", columnList = "user_id, create_date")
        }
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class PostComment extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "photo_id", nullable = false)
    private PlacePhoto placePhoto;

    @Column(nullable = false, length = 500)
    private String content;

    /**
     * 인증샷 댓글 이미지의 정적 URL (예: "/uploads/comments/2026/04/26/{uuid}.jpg").
     * 텍스트-only 댓글이면 null. 댓글 1건당 최대 1장.
     */
    @Column(name = "image_url", length = 500)
    private String imageUrl;
}
