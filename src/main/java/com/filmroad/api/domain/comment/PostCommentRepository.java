package com.filmroad.api.domain.comment;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PostCommentRepository extends JpaRepository<PostComment, Long> {

    @Query("""
            SELECT c FROM PostComment c
            JOIN FETCH c.user u
            WHERE c.placePhoto.id = :photoId AND c.id > :cursor
            ORDER BY c.id ASC
            """)
    List<PostComment> findPageByPhoto(@Param("photoId") Long photoId,
                                      @Param("cursor") Long cursor,
                                      Pageable pageable);

    boolean existsByIdAndUserId(Long id, Long userId);

    /**
     * 부모 댓글의 자식 답글 목록. 부모 삭제 시 service-level cascade 에서 사용 —
     * 자식들의 첨부 이미지 파일 정리 + commentCount 차감을 위해 엔티티 채로 받아온다.
     * 답글은 깊이 1 만 허용되므로 자식의 자식은 없음.
     */
    List<PostComment> findByParentId(Long parentId);
}
