package com.filmroad.api.domain.badge;

import com.filmroad.api.common.model.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "badge")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Badge extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40, unique = true)
    private String code;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(length = 200)
    private String description;

    @Column(name = "icon_key", nullable = false, length = 40)
    private String iconKey;

    @Column(nullable = false, length = 40)
    private String gradient;

    @Column(name = "order_index", nullable = false, columnDefinition = "INT DEFAULT 0")
    private int orderIndex;

    @Enumerated(EnumType.STRING)
    @Column(name = "condition_type", nullable = false, length = 30)
    private BadgeConditionType conditionType;

    @Column(name = "condition_threshold")
    private Integer conditionThreshold;

    @Column(name = "condition_work_id")
    private Long conditionWorkId;
}
