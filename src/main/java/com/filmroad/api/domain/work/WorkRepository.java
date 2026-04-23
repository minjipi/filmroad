package com.filmroad.api.domain.work;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface WorkRepository extends JpaRepository<Work, Long> {

    /**
     * 제목 부분일치(대소문자 무시) 검색. 통합 검색 API(`GET /api/search`)의 작품 섹션에서 사용.
     */
    @Query("""
            SELECT w FROM Work w
            WHERE LOWER(w.title) LIKE LOWER(CONCAT('%', :q, '%'))
            ORDER BY w.title ASC, w.id ASC
            """)
    List<Work> searchByTitle(@Param("q") String q, Pageable pageable);

    /**
     * 홈 "인기 작품" 섹션용 집계 쿼리. 작품별로 묶인 Place 의 trendingScore 합을 기준으로 정렬,
     * 동점은 placeCount DESC → title ASC 로 tie-break. Place 가 전혀 없는 Work 는 결과에서 제외됨
     * (홈 표면에 띄울 콘텐츠가 없으므로 의도된 동작).
     *
     * 반환: `[[Work w, Long placeCount, Long trendingScoreSum], ...]`.
     */
    @Query("""
            SELECT w, COUNT(p), SUM(p.trendingScore)
            FROM Place p JOIN p.work w
            GROUP BY w
            ORDER BY SUM(p.trendingScore) DESC, COUNT(p) DESC, w.title ASC
            """)
    List<Object[]> findPopular(Pageable pageable);
}
