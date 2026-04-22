package com.filmroad.api.domain.badge;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserBadgeRepository extends JpaRepository<UserBadge, Long> {

    @Query("SELECT ub FROM UserBadge ub JOIN FETCH ub.badge WHERE ub.user.id = :userId ORDER BY ub.acquiredAt DESC")
    List<UserBadge> findByUserIdOrderByAcquiredAtDesc(@Param("userId") Long userId);

    boolean existsByUserIdAndBadgeId(Long userId, Long badgeId);
}
