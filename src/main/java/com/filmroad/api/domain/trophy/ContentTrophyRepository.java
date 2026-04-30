package com.filmroad.api.domain.trophy;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ContentTrophyRepository extends JpaRepository<ContentTrophy, Long> {

    Optional<ContentTrophy> findByUserIdAndContentId(Long userId, Long contentId);

    /**
     * 한 유저의 모든 트로피를 awardedAt DESC 로 (최신 마일스톤이 위) JOIN FETCH content 까지.
     * 프로필 / 공개 프로필의 "마스터 작품" shelf 데이터 소스.
     */
    @Query("""
            SELECT t FROM ContentTrophy t
            JOIN FETCH t.content c
            WHERE t.user.id = :userId
            ORDER BY t.awardedAt DESC
            """)
    List<ContentTrophy> findByUserIdWithContent(@Param("userId") Long userId);
}
