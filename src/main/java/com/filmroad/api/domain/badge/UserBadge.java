package com.filmroad.api.domain.badge;

import com.filmroad.api.common.model.BaseEntity;
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
        name = "user_badge",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_badge", columnNames = {"user_id", "badge_id"})
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class UserBadge extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "badge_id", nullable = false)
    private Badge badge;

    @Column(name = "acquired_at", nullable = false)
    private Date acquiredAt;

    @PrePersist
    void ensureAcquiredAt() {
        if (this.acquiredAt == null) {
            this.acquiredAt = Timestamp.from(Instant.now());
        }
    }
}
