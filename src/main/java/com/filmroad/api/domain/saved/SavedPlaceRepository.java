package com.filmroad.api.domain.saved;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SavedPlaceRepository extends JpaRepository<SavedPlace, Long> {

    @Query("""
            SELECT sp FROM SavedPlace sp
            JOIN FETCH sp.place p
            JOIN FETCH p.work w
            LEFT JOIN FETCH sp.collection
            WHERE sp.user.id = :userId
            ORDER BY sp.createdAt DESC
            """)
    List<SavedPlace> findByUserIdOrderByCreatedAtDesc(@Param("userId") Long userId);

    boolean existsByUserIdAndPlaceId(Long userId, Long placeId);

    @Modifying
    @Query("DELETE FROM SavedPlace sp WHERE sp.user.id = :userId AND sp.place.id = :placeId")
    int deleteByUserIdAndPlaceId(@Param("userId") Long userId, @Param("placeId") Long placeId);

    long countByUserId(Long userId);
}
