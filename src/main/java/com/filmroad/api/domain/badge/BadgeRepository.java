package com.filmroad.api.domain.badge;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BadgeRepository extends JpaRepository<Badge, Long> {

    List<Badge> findAllByOrderByOrderIndexAsc();
}
