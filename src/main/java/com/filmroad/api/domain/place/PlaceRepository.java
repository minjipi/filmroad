package com.filmroad.api.domain.place;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface PlaceRepository extends JpaRepository<Place, Long> {

    @Query("SELECT p FROM Place p JOIN FETCH p.content w WHERE (:contentId IS NULL OR w.id = :contentId) ORDER BY p.trendingScore DESC, p.id ASC")
    List<Place> findTrending(@Param("contentId") Long contentId);

    @Query("SELECT p FROM Place p JOIN FETCH p.content w WHERE (:contentId IS NULL OR w.id = :contentId)")
    List<Place> findAllWithContent(@Param("contentId") Long contentId);

    /**
     * 전국 뷰(viewport bbox 없음). 인기 장소 상위 N개를 선별해야 하므로 trendingScore 내림차순 정렬.
     * 호출자 (MapService) 는 상단 limit 만 잘라 사용.
     */
    @Query("""
            SELECT p FROM Place p JOIN FETCH p.content w
            WHERE (:contentId IS NULL OR w.id = :contentId)
              AND (:q IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(p.regionLabel) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(w.title) LIKE LOWER(CONCAT('%', :q, '%')))
            ORDER BY p.trendingScore DESC, p.id ASC
            """)
    List<Place> searchForMap(@Param("contentId") Long contentId, @Param("q") String q);

    /**
     * viewport bbox 활성 뷰. trendingScore 정렬을 쓰지 않고 id 오름차순만. 이유:
     * viewport 가 자연 제한 역할을 하므로 지역 장소를 trendingScore 낮다는 이유로 잘라내면
     * "부산/대구/강원 쪽으로 이동해도 장소가 안 보인다" 증상이 생김. 4개 좌표는 호출 전에 전부 유효성 검증됨.
     */
    @Query("""
            SELECT p FROM Place p JOIN FETCH p.content w
            WHERE (:contentId IS NULL OR w.id = :contentId)
              AND (:q IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(p.regionLabel) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(w.title) LIKE LOWER(CONCAT('%', :q, '%')))
              AND p.latitude BETWEEN :swLat AND :neLat
              AND p.longitude BETWEEN :swLng AND :neLng
            ORDER BY p.id ASC
            """)
    List<Place> findInBoundsForMap(@Param("contentId") Long contentId,
                                   @Param("q") String q,
                                   @Param("swLat") Double swLat,
                                   @Param("swLng") Double swLng,
                                   @Param("neLat") Double neLat,
                                   @Param("neLng") Double neLng);

    @Query("""
            SELECT p FROM Place p JOIN FETCH p.content w
            WHERE w.id = :contentId AND p.id <> :excludeId
            ORDER BY p.trendingScore DESC, p.id ASC
            """)
    List<Place> findByContentIdAndIdNotOrderByTrendingScoreDescIdAsc(
            @Param("contentId") Long contentId, @Param("excludeId") Long excludeId);

    long countByContentId(Long contentId);

    @Query("SELECT p FROM Place p JOIN FETCH p.content w WHERE w.id = :contentId ORDER BY p.id ASC")
    List<Place> findByContentIdOrderByIdAsc(@Param("contentId") Long contentId);

    /**
     * 통합 검색 장소 섹션 — 장소명 / 지역 라벨 부분일치(대소문자 무시). trending 우선 정렬로 인기 장소 상단.
     */
    @Query("""
            SELECT p FROM Place p JOIN FETCH p.content w
            WHERE LOWER(p.name) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(p.regionLabel) LIKE LOWER(CONCAT('%', :q, '%'))
            ORDER BY p.trendingScore DESC, p.id ASC
            """)
    List<Place> searchByNameOrRegion(@Param("q") String q, Pageable pageable);

    /**
     * 여러 contentId 의 장소 수를 한 번에 집계. 통합 검색에서 Content 결과별 placeCount 채울 때 N+1 방지용.
     * 반환 형태: [[contentId, count], ...].
     */
    @Query("SELECT p.content.id, COUNT(p) FROM Place p WHERE p.content.id IN :contentIds GROUP BY p.content.id")
    List<Object[]> countByContentIdIn(@Param("contentIds") Collection<Long> contentIds);
}
