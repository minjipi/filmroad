package com.filmroad.api.domain.like;

import com.filmroad.api.common.model.BaseEntity;
import com.filmroad.api.domain.place.Place;
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
        name = "place_like",
        uniqueConstraints = @UniqueConstraint(name = "uk_place_like_user_place", columnNames = {"user_id", "place_id"}),
        indexes = @Index(name = "idx_place_like_user", columnList = "user_id, create_date")
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class PlaceLike extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "place_id", nullable = false)
    private Place place;
}
