package com.filmroad.api.domain.trophy;

import com.filmroad.api.common.model.BaseEntity;
import com.filmroad.api.domain.content.Content;
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

/**
 * 사용자가 한 작품(Content) 의 성지 일정 비율 이상을 모았을 때 부여되는 트로피.
 * 25 / 50 / 75 / 100 % 마일스톤마다 tier 가 한 단계씩 격상되며, row 는
 * (user, content) 쌍당 1개만 존재(unique). tier 가 더 높은 단계로 올라가면
 * 같은 row 의 tier / awarded_at 을 갱신한다.
 *
 * <p>한번 획득한 트로피는 사진/스탬프가 사라져도 유지(영구 정체성). 즉 trophy
 * 는 derived 가 아니라 1급 데이터로 저장된다.</p>
 */
@Getter
@Entity
@Table(
        name = "content_trophy",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_content_trophy_user_content",
                columnNames = {"user_id", "content_id"}),
        indexes = @Index(name = "idx_content_trophy_user", columnList = "user_id, awarded_at")
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class ContentTrophy extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "content_id", nullable = false)
    private Content content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContentTrophyTier tier;

    /**
     * 가장 마지막에 tier 가 갱신된 시각. 프로필 자랑 카드의 "X 일 전 마스터" 표기에 사용.
     */
    @Column(name = "awarded_at", nullable = false)
    private Date awardedAt;

    @PrePersist
    void ensureAwardedAt() {
        if (this.awardedAt == null) {
            this.awardedAt = Timestamp.from(Instant.now());
        }
    }

    /** tier 격상 시 같은 row 의 tier / awardedAt 을 갱신한다. */
    public void promote(ContentTrophyTier newTier) {
        this.tier = newTier;
        this.awardedAt = Timestamp.from(Instant.now());
    }
}
