package com.filmroad.api.domain.like;

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
        name = "photo_like",
        uniqueConstraints = @UniqueConstraint(name = "uk_photo_like_user_photo", columnNames = {"user_id", "photo_id"}),
        indexes = @Index(name = "idx_photo_like_user", columnList = "user_id, create_date")
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class PhotoLike extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "photo_id", nullable = false)
    private PlacePhoto placePhoto;
}
