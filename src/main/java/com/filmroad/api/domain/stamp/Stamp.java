package com.filmroad.api.domain.stamp;

import com.filmroad.api.common.model.BaseEntity;
import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlacePhoto;
import com.filmroad.api.domain.user.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Date;

@Getter
@Entity
@Table(
        name = "stamp",
        uniqueConstraints = @UniqueConstraint(name = "uk_stamp_user_place", columnNames = {"user_id", "place_id"}),
        indexes = @Index(name = "idx_stamp_user", columnList = "user_id")
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Stamp extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "place_id", nullable = false)
    private Place place;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "photo_id")
    private PlacePhoto photo;

    @Column(name = "acquired_at", nullable = false)
    private Date acquiredAt;

    @PrePersist
    void ensureAcquiredAt() {
        if (this.acquiredAt == null) {
            this.acquiredAt = Timestamp.from(Instant.now());
        }
    }
}
