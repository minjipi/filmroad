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
}
