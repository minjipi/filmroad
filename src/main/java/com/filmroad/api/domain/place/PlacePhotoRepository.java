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
}
