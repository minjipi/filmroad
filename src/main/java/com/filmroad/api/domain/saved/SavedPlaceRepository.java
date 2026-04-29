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
            JOIN FETCH p.content w
            LEFT JOIN FETCH sp.collection
            WHERE sp.user.id = :userId
            ORDER BY sp.createdAt DESC
            """)
    List<SavedPlace> findByUserIdOrderByCreatedAtDesc(@Param("userId") Long userId);

    /**
     * 특정 컬렉션 내 저장 장소 목록. 컬렉션 상세 `GET /api/saved/collections/:id` 에서 방문 순서를
     * createdAt 오름차순(저장 시점 순) 으로 고정.
     */
    @Query("""
            SELECT sp FROM SavedPlace sp
            JOIN FETCH sp.place p
            JOIN FETCH p.content w
            WHERE sp.collection.id = :collectionId
            ORDER BY sp.createdAt ASC, sp.id ASC
            """)
    List<SavedPlace> findByCollectionIdOrderByCreatedAtAsc(@Param("collectionId") Long collectionId);

    boolean existsByUserIdAndPlaceId(Long userId, Long placeId);

    @Modifying
    @Query("DELETE FROM SavedPlace sp WHERE sp.user.id = :userId AND sp.place.id = :placeId")
    int deleteByUserIdAndPlaceId(@Param("userId") Long userId, @Param("placeId") Long placeId);

    @Modifying
    @Query("DELETE FROM SavedPlace sp WHERE sp.collection.id = :collectionId")
    int deleteByCollectionId(@Param("collectionId") Long collectionId);

    long countByUserId(Long userId);
}
