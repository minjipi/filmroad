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
}
