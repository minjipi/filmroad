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
}
