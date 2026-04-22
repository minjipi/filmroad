package com.filmroad.api.domain.saved;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CollectionRepository extends JpaRepository<Collection, Long> {

    List<Collection> findByUserIdOrderByCreatedAtAsc(Long userId);

    @Query("SELECT COUNT(sp) FROM SavedPlace sp WHERE sp.collection.id = :collectionId")
    long countSavedByCollectionId(@Param("collectionId") Long collectionId);
}
