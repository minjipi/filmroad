package com.filmroad.api.domain.saved;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

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
     * 특정 컬렉션 내 저장 장소 목록. 트립 루트 재정렬 결과를 반영하기 위해
     * `orderIndex` ASC, `id` ASC (안정적 tiebreak) 로 정렬.
     */
    @Query("""
            SELECT sp FROM SavedPlace sp
            JOIN FETCH sp.place p
            JOIN FETCH p.content w
            WHERE sp.collection.id = :collectionId
            ORDER BY sp.orderIndex ASC, sp.id ASC
            """)
    List<SavedPlace> findByCollectionIdOrderedForRoute(@Param("collectionId") Long collectionId);

    /** 트립 reorder 시 입력 placeIds 검증과 매칭에 사용 — collection 안의 place_id 집합. */
    @Query("SELECT sp.place.id FROM SavedPlace sp WHERE sp.collection.id = :collectionId")
    List<Long> findPlaceIdsByCollectionId(@Param("collectionId") Long collectionId);

    /** 메모 PATCH / 단건 remove 진입점. (user, place) 유니크 보장 — userId 까지 합쳐 enumeration 방지. */
    @Query("""
            SELECT sp FROM SavedPlace sp
            JOIN FETCH sp.place p
            WHERE sp.user.id = :userId AND sp.place.id = :placeId
            """)
    Optional<SavedPlace> findByUserIdAndPlaceId(@Param("userId") Long userId, @Param("placeId") Long placeId);

    /** 컬렉션 내 다음 orderIndex 계산용. 비어 있으면 null → 호출자가 0 으로 시작. */
    @Query("SELECT MAX(sp.orderIndex) FROM SavedPlace sp WHERE sp.collection.id = :collectionId")
    Integer findMaxOrderIndexByCollectionId(@Param("collectionId") Long collectionId);

    boolean existsByUserIdAndPlaceId(Long userId, Long placeId);

    @Modifying
    @Query("DELETE FROM SavedPlace sp WHERE sp.user.id = :userId AND sp.place.id = :placeId")
    int deleteByUserIdAndPlaceId(@Param("userId") Long userId, @Param("placeId") Long placeId);

    @Modifying
    @Query("DELETE FROM SavedPlace sp WHERE sp.collection.id = :collectionId")
    int deleteByCollectionId(@Param("collectionId") Long collectionId);

    long countByUserId(Long userId);
}
