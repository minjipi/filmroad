package com.filmroad.api.domain.place;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PlacePhotoRepository extends JpaRepository<PlacePhoto, Long> {

    List<PlacePhoto> findByPlaceIdOrderByOrderIndexAscIdAsc(Long placeId, Pageable pageable);

    @Query("SELECT COALESCE(MAX(p.orderIndex), -1) FROM PlacePhoto p WHERE p.place.id = :placeId")
    int findMaxOrderIndexByPlaceId(@Param("placeId") Long placeId);

    Page<PlacePhoto> findByPlaceIdOrderByCreatedAtDesc(Long placeId, Pageable pageable);

    Page<PlacePhoto> findByPlaceIdOrderByOrderIndexDescIdDesc(Long placeId, Pageable pageable);

    long countByPlaceId(Long placeId);

    /**
     * 유저가 사진을 올린 적이 있는 place id 집합을 batch 로 반환. 컬렉션 상세의 "인증" 판정에 사용.
     */
    @Query("SELECT DISTINCT p.place.id FROM PlacePhoto p WHERE p.user.id = :userId AND p.place.id IN :placeIds")
    List<Long> findDistinctPlaceIdsByUserIdAndPlaceIdIn(@Param("userId") Long userId,
                                                       @Param("placeIds") java.util.Collection<Long> placeIds);

    @Query("""
            SELECT p FROM PlacePhoto p
            JOIN FETCH p.place pl
            JOIN FETCH pl.work w
            LEFT JOIN FETCH p.user u
            WHERE (:workId IS NULL OR w.id = :workId)
              AND (:cursor IS NULL OR p.id < :cursor)
            ORDER BY p.likeCount DESC, p.id DESC
            """)
    List<PlacePhoto> findFeedPopular(@Param("workId") Long workId,
                                     @Param("cursor") Long cursor,
                                     Pageable pageable);

    @Query("""
            SELECT p FROM PlacePhoto p
            JOIN FETCH p.place pl
            JOIN FETCH pl.work w
            LEFT JOIN FETCH p.user u
            WHERE (:workId IS NULL OR w.id = :workId)
              AND (:cursor IS NULL OR p.id < :cursor)
            ORDER BY p.id DESC
            """)
    List<PlacePhoto> findFeedRecent(@Param("workId") Long workId,
                                    @Param("cursor") Long cursor,
                                    Pageable pageable);

    @Query("""
            SELECT p FROM PlacePhoto p
            JOIN FETCH p.place pl
            JOIN FETCH pl.work w
            LEFT JOIN FETCH p.user u
            WHERE p.user.id IN (SELECT f.followee.id FROM UserFollow f WHERE f.follower.id = :followerId)
              AND (:workId IS NULL OR w.id = :workId)
              AND (:cursor IS NULL OR p.id < :cursor)
            ORDER BY p.id DESC
            """)
    List<PlacePhoto> findFeedByFollowedUsers(@Param("followerId") Long followerId,
                                             @Param("workId") Long workId,
                                             @Param("cursor") Long cursor,
                                             Pageable pageable);
}
