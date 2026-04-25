package com.filmroad.api.domain.saved;

import com.filmroad.api.common.model.BaseEntity;
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
        name = "saved_collection",
        indexes = @Index(name = "idx_saved_collection_user", columnList = "user_id")
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Collection extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 20)
    private String name;

    @Column(length = 200)
    private String description;

    @Column(name = "cover_place_id")
    private Long coverPlaceId;

    @Column(length = 40)
    private String gradient;

    public void rename(String newName) {
        this.name = newName;
    }
}
