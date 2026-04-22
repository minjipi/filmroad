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

    // 업로드 보상 로직에서 포인트/레벨/스트릭/사진수 증가에 쓰는 상태 업데이트 헬퍼.
    public void applyUploadReward(int pointsDelta, int newStreakDays, int newLevel) {
        this.points += pointsDelta;
        this.streakDays = newStreakDays;
        this.level = newLevel;
        this.totalPhotoCount += 1;
    }
}
