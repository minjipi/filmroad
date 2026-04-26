package com.filmroad.api.domain.place;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface KakaoPlaceInfoRepository extends JpaRepository<KakaoPlaceInfo, Long> {

    Optional<KakaoPlaceInfo> findByPlaceId(Long placeId);
}
