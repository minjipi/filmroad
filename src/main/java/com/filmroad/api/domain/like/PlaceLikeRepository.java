package com.filmroad.api.domain.like;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface PlaceLikeRepository extends JpaRepository<PlaceLike, Long> {

    boolean existsByUserIdAndPlaceId(Long userId, Long placeId);

    @Modifying
    @Query("DELETE FROM PlaceLike pl WHERE pl.user.id = :userId AND pl.place.id = :placeId")
    int deleteByUserIdAndPlaceId(@Param("userId") Long userId, @Param("placeId") Long placeId);

    @Query("SELECT pl.place.id FROM PlaceLike pl WHERE pl.user.id = :userId AND pl.place.id IN :placeIds")
    List<Long> findPlaceIdsLikedByUser(@Param("userId") Long userId, @Param("placeIds") Collection<Long> placeIds);

    /**
     * 좋아요한 장소 페이지네이션 — PlaceLike PK 의 id DESC. cursor 가 null 이면 첫 페이지,
     * 값이 있으면 그 미만의 row 만 이어서 반환한다. JOIN FETCH 로 place + content + cover
     * 까지 한 번에 끌어와 N+1 회피.
     */
    @Query("""
            SELECT pl FROM PlaceLike pl
            JOIN FETCH pl.place p
            LEFT JOIN FETCH p.content
            LEFT JOIN FETCH p.coverImages
            WHERE pl.user.id = :userId
              AND (:cursor IS NULL OR pl.id < :cursor)
            ORDER BY pl.id DESC
            """)
    List<PlaceLike> findByUserIdWithCursor(
            @Param("userId") Long userId,
            @Param("cursor") Long cursor,
            Pageable pageable);
}
