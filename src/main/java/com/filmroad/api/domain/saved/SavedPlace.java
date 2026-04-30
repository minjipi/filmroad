package com.filmroad.api.domain.saved;

import com.filmroad.api.common.model.BaseEntity;
import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.user.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(
        name = "saved_place",
        uniqueConstraints = @UniqueConstraint(name = "uk_saved_place_user_place", columnNames = {"user_id", "place_id"}),
        indexes = {
                @Index(name = "idx_saved_place_user", columnList = "user_id"),
                @Index(name = "idx_saved_place_collection_order", columnList = "collection_id, order_index")
        }
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class SavedPlace extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "place_id", nullable = false)
    private Place place;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "collection_id")
    private Collection collection;

    /**
     * 컬렉션 안에서의 정렬 순서 (0-based, 작을수록 앞). 같은 collection 내 unique 가 아닌 dense.
     * 트립 루트 reorder 시 일괄 갱신, place 추가 시 max(orderIndex) + 1 로 끝에 append.
     * collection 이 null 이면 의미 없음(미할당 저장) — 기본 0 으로 둔다.
     */
    @Column(name = "order_index", nullable = false, columnDefinition = "INT DEFAULT 0")
    @Builder.Default
    private int orderIndex = 0;

    /**
     * 트립 루트의 장소별 사용자 메모. 디자인 시안의 "남이섬 — 메타세쿼이아 길에서 사진 필수" 형태.
     * 미입력 시 null. 길이 상한 500 자.
     */
    @Column(name = "user_note", length = 500)
    private String userNote;

    /** Service 가 reorder/append 시 호출. dirty checking 으로 update 됨. */
    public void assignOrderIndex(int orderIndex) {
        this.orderIndex = orderIndex;
    }

    /** 컬렉션 이동 시 호출 — collection_id 와 새 orderIndex 동시 갱신. */
    public void moveToCollection(Collection collection, int orderIndex) {
        this.collection = collection;
        this.orderIndex = orderIndex;
    }

    /** 메모 갱신 — null/빈 문자열 모두 허용 (clear 효과). */
    public void updateUserNote(String userNote) {
        this.userNote = userNote;
    }
}
