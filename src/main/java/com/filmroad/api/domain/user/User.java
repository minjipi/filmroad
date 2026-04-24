package com.filmroad.api.domain.user;

import com.filmroad.api.common.model.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "users")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class User extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String nickname;

    @Column(nullable = false, length = 60, unique = true)
    private String handle;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(length = 300)
    private String bio;

    @Column(nullable = false, columnDefinition = "INT DEFAULT 1")
    private int level;

    @Column(nullable = false, columnDefinition = "INT DEFAULT 0")
    private int points;

    @Column(name = "streak_days", nullable = false, columnDefinition = "INT DEFAULT 0")
    private int streakDays;

    @Column(name = "followers_count", nullable = false, columnDefinition = "INT DEFAULT 0")
    private int followersCount;

    @Column(name = "following_count", nullable = false, columnDefinition = "INT DEFAULT 0")
    private int followingCount;

    @Column(name = "total_photo_count", nullable = false, columnDefinition = "INT DEFAULT 0")
    private int totalPhotoCount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "VARCHAR(20) DEFAULT 'DEMO'")
    private AuthProvider provider;

    @Column(name = "provider_id", length = 120)
    private String providerId;

    @Column(length = 200)
    private String email;

    // BCrypt hash. Only populated for AuthProvider.EMAIL users; OAuth/DEMO users remain null.
    @Column(name = "password_hash", length = 200)
    private String passwordHash;

    @Column(nullable = false, columnDefinition = "BOOLEAN DEFAULT FALSE")
    private boolean verified;

    // 업로드 보상 로직에서 포인트/레벨/스트릭/사진수 증가에 쓰는 상태 업데이트 헬퍼.
    public void applyUploadReward(int pointsDelta, int newStreakDays, int newLevel) {
        this.points += pointsDelta;
        this.streakDays = newStreakDays;
        this.level = newLevel;
        this.totalPhotoCount += 1;
    }

    public void applyFollowerDelta(int delta) {
        this.followersCount = Math.max(0, this.followersCount + delta);
    }

    public void applyFollowingDelta(int delta) {
        this.followingCount = Math.max(0, this.followingCount + delta);
    }

    // 프로필 편집 적용. null 필드는 "변경 없음". bio/avatarUrl 은 빈 문자열로 지우기 허용.
    public void updateProfile(String nickname, String bio, String avatarUrl) {
        if (nickname != null) {
            String trimmed = nickname.trim();
            if (!trimmed.isEmpty()) this.nickname = trimmed;
        }
        if (bio != null) {
            this.bio = bio.isBlank() ? null : bio.trim();
        }
        if (avatarUrl != null) {
            this.avatarUrl = avatarUrl.isBlank() ? null : avatarUrl.trim();
        }
    }
}
