package com.filmroad.api.domain.follow;

import org.springframework.data.domain.Pageable;
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

    /**
     * `userId` 를 follow 하는 사람들의 UserFollow row 목록. row id DESC (최근 follow 한
     * 사람부터 노출 — Instagram / 카카오 패턴). cursor 는 직전 페이지의 마지막 row id;
     * 첫 페이지는 cursor = Long.MAX_VALUE 로 호출.
     */
    @Query("""
            SELECT f FROM UserFollow f
            JOIN FETCH f.follower
            WHERE f.followee.id = :userId AND f.id < :cursor
            ORDER BY f.id DESC
            """)
    List<UserFollow> findFollowersOf(@Param("userId") Long userId,
                                     @Param("cursor") Long cursor,
                                     Pageable pageable);

    /**
     * `userId` 가 follow 하는 followee 목록의 UserFollow row.
     */
    @Query("""
            SELECT f FROM UserFollow f
            JOIN FETCH f.followee
            WHERE f.follower.id = :userId AND f.id < :cursor
            ORDER BY f.id DESC
            """)
    List<UserFollow> findFollowingsOf(@Param("userId") Long userId,
                                      @Param("cursor") Long cursor,
                                      Pageable pageable);
}
