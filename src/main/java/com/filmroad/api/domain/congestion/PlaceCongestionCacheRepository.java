package com.filmroad.api.domain.congestion;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PlaceCongestionCacheRepository extends JpaRepository<PlaceCongestionCache, Long> {

    Optional<PlaceCongestionCache> findByPlaceId(Long placeId);
}
