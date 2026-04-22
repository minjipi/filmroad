package com.filmroad.api.domain.place;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PlaceRepository extends JpaRepository<Place, Long> {

    @Query("SELECT p FROM Place p JOIN FETCH p.work w WHERE (:workId IS NULL OR w.id = :workId) ORDER BY p.trendingScore DESC, p.id ASC")
    List<Place> findTrending(@Param("workId") Long workId);

    @Query("SELECT p FROM Place p JOIN FETCH p.work w WHERE (:workId IS NULL OR w.id = :workId)")
    List<Place> findAllWithWork(@Param("workId") Long workId);

    @Query("""
            SELECT p FROM Place p JOIN FETCH p.work w
            WHERE (:workId IS NULL OR w.id = :workId)
              AND (:q IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(p.regionLabel) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(w.title) LIKE LOWER(CONCAT('%', :q, '%')))
            ORDER BY p.trendingScore DESC, p.id ASC
            """)
    List<Place> searchForMap(@Param("workId") Long workId, @Param("q") String q);

    @Query("""
            SELECT p FROM Place p JOIN FETCH p.work w
            WHERE w.id = :workId AND p.id <> :excludeId
            ORDER BY p.trendingScore DESC, p.id ASC
            """)
    List<Place> findByWorkIdAndIdNotOrderByTrendingScoreDescIdAsc(
            @Param("workId") Long workId, @Param("excludeId") Long excludeId);

    long countByWorkId(Long workId);

    @Query("SELECT p FROM Place p JOIN FETCH p.work w WHERE w.id = :workId ORDER BY p.id ASC")
    List<Place> findByWorkIdOrderByIdAsc(@Param("workId") Long workId);
}
