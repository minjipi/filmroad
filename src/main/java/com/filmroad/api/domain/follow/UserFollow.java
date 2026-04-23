package com.filmroad.api.domain.follow;

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
@Table(
        name = "user_follow",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_follow_pair", columnNames = {"follower_id", "followee_id"}),
        indexes = {
                @Index(name = "idx_user_follow_follower", columnList = "follower_id, create_date"),
                @Index(name = "idx_user_follow_followee", columnList = "followee_id, create_date")
        }
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class UserFollow extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "follower_id", nullable = false)
    private User follower;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "followee_id", nullable = false)
    private User followee;
}
