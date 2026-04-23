package com.filmroad.api.domain.stamp;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StampRepository extends JpaRepository<Stamp, Long> {

    @Query("SELECT s FROM Stamp s JOIN FETCH s.place p JOIN FETCH p.work w WHERE s.user.id = :userId ORDER BY s.acquiredAt DESC")
    List<Stamp> findByUserIdOrderByAcquiredAtDesc(@Param("userId") Long userId);

    @Query("SELECT s FROM Stamp s JOIN FETCH s.place p JOIN FETCH p.work w WHERE s.user.id = :userId AND w.id = :workId")
    List<Stamp> findByUserIdAndWorkId(@Param("userId") Long userId, @Param("workId") Long workId);

    long countByUserId(Long userId);

    @Query("SELECT COUNT(s) FROM Stamp s WHERE s.user.id = :userId AND s.place.work.id = :workId")
    long countByUserIdAndWorkId(@Param("userId") Long userId, @Param("workId") Long workId);

    boolean existsByUserIdAndPlaceId(Long userId, Long placeId);

    @Query("SELECT DISTINCT s.place.work.id FROM Stamp s WHERE s.user.id = :userId")
    List<Long> findDistinctWorkIdsByUserId(@Param("userId") Long userId);

    java.util.Optional<Stamp> findByUserIdAndPlaceId(Long userId, Long placeId);

    @Query("""
            SELECT s.user.id AS userId, COUNT(s) AS cnt
            FROM Stamp s
            WHERE (:workId IS NULL OR s.place.work.id = :workId)
            GROUP BY s.user.id
            ORDER BY COUNT(s) DESC, s.user.id ASC
            """)
    List<Object[]> aggregateUserStampCount(@Param("workId") Long workId,
                                           org.springframework.data.domain.Pageable pageable);
}
