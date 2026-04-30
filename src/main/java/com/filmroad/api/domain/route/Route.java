package com.filmroad.api.domain.route;

import com.filmroad.api.common.model.BaseEntity;
import com.filmroad.api.domain.content.Content;
import com.filmroad.api.domain.user.User;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * 사용자가 저장한 트립 코스. 출발 시각 + 순서 있는 RoutePlace 묶음.
 *
 * <p>{@link #content} 는 nullable — content 기반이 아닌 사용자 자유 코스도 허용.</p>
 */
@Getter
@Entity
@Table(name = "route", indexes = {
        @Index(name = "idx_route_user_updated", columnList = "user_id, UPDATE_DATE")
})
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Route extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "content_id")
    private Content content;

    @Column(nullable = false, length = 120)
    private String name;

    /** "HH:mm" 형식. 5자 고정. */
    @Column(name = "start_time", nullable = false, length = 5)
    private String startTime;

    @OneToMany(mappedBy = "route", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("orderIndex ASC")
    @Builder.Default
    private List<RoutePlace> places = new ArrayList<>();

    /** 메타데이터(이름/시작시각/콘텐츠) 갱신. updatedAt 은 BaseEntity @PreUpdate 가 처리. */
    public void updateMeta(String name, String startTime, Content content) {
        this.name = name;
        this.startTime = startTime;
        this.content = content;
    }

    /**
     * places 리스트 통째 교체. orphanRemoval 로 기존 RoutePlace 가 cascade 삭제되고,
     * 새 RoutePlace 들은 양방향 연결을 보장.
     */
    public void replacePlaces(List<RoutePlace> next) {
        this.places.clear();
        for (RoutePlace rp : next) {
            rp.attachToRoute(this);
            this.places.add(rp);
        }
    }
}
