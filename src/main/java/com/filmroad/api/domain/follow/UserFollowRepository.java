package com.filmroad.api.domain.follow;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface UserFollowRepository extends JpaRepository<UserFollow, Long> {

    boolean existsByFollowerIdAndFolloweeId(Long followerId, Long followeeId);

    @Modifying
    @Query("DELETE FROM UserFollow f WHERE f.follower.id = :followerId AND f.followee.id = :followeeId")
    int deleteByFollowerIdAndFolloweeId(@Param("followerId") Long followerId, @Param("followeeId") Long followeeId);

    @Query("SELECT f.followee.id FROM UserFollow f WHERE f.follower.id = :followerId AND f.followee.id IN :candidates")
    List<Long> findFolloweeIdsByFollowerAndFolloweeIdIn(@Param("followerId") Long followerId,
                                                       @Param("candidates") Collection<Long> candidates);

    @Query("SELECT f.followee.id FROM UserFollow f WHERE f.follower.id = :followerId")
    List<Long> findFolloweeIdsByFollower(@Param("followerId") Long followerId);
}
