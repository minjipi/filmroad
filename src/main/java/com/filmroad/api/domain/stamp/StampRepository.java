package com.filmroad.api.domain.stamp;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StampRepository extends JpaRepository<Stamp, Long> {

    @Query("SELECT s FROM Stamp s JOIN FETCH s.place p JOIN FETCH p.content w WHERE s.user.id = :userId ORDER BY s.acquiredAt DESC")
    List<Stamp> findByUserIdOrderByAcquiredAtDesc(@Param("userId") Long userId);

    @Query("SELECT s FROM Stamp s JOIN FETCH s.place p JOIN FETCH p.content w WHERE s.user.id = :userId AND w.id = :contentId")
    List<Stamp> findByUserIdAndContentId(@Param("userId") Long userId, @Param("contentId") Long contentId);

    long countByUserId(Long userId);

    @Query("SELECT COUNT(s) FROM Stamp s WHERE s.user.id = :userId AND s.place.content.id = :contentId")
    long countByUserIdAndContentId(@Param("userId") Long userId, @Param("contentId") Long contentId);

    boolean existsByUserIdAndPlaceId(Long userId, Long placeId);

    /**
     * 특정 유저가 방문 도장(Stamp) 을 찍은 place 를 batch 로 조회. CollectionDetailResponse 의 visitedAt 계산용.
     */
    @Query("SELECT s FROM Stamp s WHERE s.user.id = :userId AND s.place.id IN :placeIds")
    List<Stamp> findByUserIdAndPlaceIdIn(@Param("userId") Long userId,
                                         @Param("placeIds") java.util.Collection<Long> placeIds);

    @Query("SELECT DISTINCT s.place.content.id FROM Stamp s WHERE s.user.id = :userId")
    List<Long> findDistinctContentIdsByUserId(@Param("userId") Long userId);

    java.util.Optional<Stamp> findByUserIdAndPlaceId(Long userId, Long placeId);

    @Query("""
            SELECT s.user.id AS userId, COUNT(s) AS cnt
            FROM Stamp s
            WHERE (:contentId IS NULL OR s.place.content.id = :contentId)
            GROUP BY s.user.id
            ORDER BY COUNT(s) DESC, s.user.id ASC
            """)
    List<Object[]> aggregateUserStampCount(@Param("contentId") Long contentId,
                                           org.springframework.data.domain.Pageable pageable);

    /**
     * 특정 유저의 stamp 를 작품별로 집계. 공개 프로필 "스탬프 북" highlight 용.
     * 반환: `[[Content w, Long count], ...]`. count DESC, tie-break title ASC.
     */
    @Query("""
            SELECT w, COUNT(s)
            FROM Stamp s JOIN s.place p JOIN p.content w
            WHERE s.user.id = :userId
            GROUP BY w
            ORDER BY COUNT(s) DESC, w.title ASC
            """)
    List<Object[]> aggregateContentsByUserId(@Param("userId") Long userId,
                                          org.springframework.data.domain.Pageable pageable);
}
