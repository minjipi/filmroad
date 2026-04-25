package com.filmroad.api.domain.place;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * PlacePhotoImage 직접 조회용. 일상적인 carousel 조회는 PlacePhoto.images @OneToMany 로 충분하지만,
 * row count 검증/배치 통계 등 직접 카운트가 필요할 때 사용.
 */
public interface PlacePhotoImageRepository extends JpaRepository<PlacePhotoImage, Long> {
}
