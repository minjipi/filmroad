package com.filmroad.api.domain.like;

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
}
