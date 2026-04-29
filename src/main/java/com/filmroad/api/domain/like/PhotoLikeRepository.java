package com.filmroad.api.domain.like;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface PhotoLikeRepository extends JpaRepository<PhotoLike, Long> {

    boolean existsByUserIdAndPlacePhotoId(Long userId, Long photoId);

    @Modifying
    @Query("DELETE FROM PhotoLike pl WHERE pl.user.id = :userId AND pl.placePhoto.id = :photoId")
    int deleteByUserIdAndPlacePhotoId(@Param("userId") Long userId, @Param("photoId") Long photoId);

    /** PhotoEditService.delete 가 hard delete 시 자식 행을 cascade 정리할 때 사용. */
    @Modifying
    @Query("DELETE FROM PhotoLike pl WHERE pl.placePhoto.id = :photoId")
    int deleteAllByPlacePhotoId(@Param("photoId") Long photoId);

    @Query("SELECT pl.placePhoto.id FROM PhotoLike pl WHERE pl.user.id = :userId AND pl.placePhoto.id IN :photoIds")
    List<Long> findPhotoIdsLikedByUser(@Param("userId") Long userId, @Param("photoIds") Collection<Long> photoIds);
}
