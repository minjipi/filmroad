package com.filmroad.api.domain.route;

import com.filmroad.api.common.model.BaseEntity;
import com.filmroad.api.domain.place.Place;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Route 의 자식 — 순서/체류시간/메모를 가진 Place 참조.
 */
@Getter
@Entity
@Table(name = "route_place", uniqueConstraints = {
        @UniqueConstraint(name = "uq_route_place_order", columnNames = {"route_id", "order_index"})
})
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class RoutePlace extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "route_id", nullable = false)
    private Route route;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "place_id", nullable = false)
    private Place place;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    @Column(name = "duration_min", nullable = false, columnDefinition = "INT DEFAULT 60")
    private int durationMin;

    @Column(columnDefinition = "TEXT")
    private String note;

    void attachToRoute(Route route) {
        this.route = route;
    }
}
