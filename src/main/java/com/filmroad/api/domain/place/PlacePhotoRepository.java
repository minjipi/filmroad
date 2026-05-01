package com.filmroad.api.domain.place;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * PlacePhoto 조회 — 대부분의 메서드는 viewer 기준 visibility 필터를 포함한다.
 *
 * <p>공통 visibility 규칙 (JPQL 로 삽입):
 * <pre>
 *   (p.visibility = 'PUBLIC')
 *   OR (p.user IS NOT NULL AND p.user.id = :viewerId)
 *   OR (p.visibility = 'FOLLOWERS'
 *       AND p.user IS NOT NULL
 *       AND p.user.id IN (SELECT f.followee.id FROM UserFollow f WHERE f.follower.id = :viewerId))
 * </pre>
 * 즉, PUBLIC 은 모두에게, 본인 것은 visibility 무관 본인에게, FOLLOWERS 는 author 를 팔로우하는 유저에게.
 */
public interface PlacePhotoRepository extends JpaRepository<PlacePhoto, Long> {

    /**
     * PlaceDetail 썸네일 리스트 (order_index ASC) — visibility 필터 포함.
     */
    @Query("""
            SELECT p FROM PlacePhoto p
            WHERE p.place.id = :placeId
              AND (
                p.visibility = com.filmroad.api.domain.place.PhotoVisibility.PUBLIC
                OR (p.user IS NOT NULL AND p.user.id = :viewerId)
                OR (p.visibility = com.filmroad.api.domain.place.PhotoVisibility.FOLLOWERS
                    AND p.user IS NOT NULL
                    AND p.user.id IN (SELECT f.followee.id FROM UserFollow f WHERE f.follower.id = :viewerId))
              )
            ORDER BY p.orderIndex ASC, p.id ASC
            """)
    List<PlacePhoto> findByPlaceIdOrderByOrderIndexAscIdAsc(@Param("placeId") Long placeId,
                                                            @Param("viewerId") Long viewerId,
                                                            Pageable pageable);

    @Query("SELECT COALESCE(MAX(p.orderIndex), -1) FROM PlacePhoto p WHERE p.place.id = :placeId")
    int findMaxOrderIndexByPlaceId(@Param("placeId") Long placeId);

    @Query(value = """
            SELECT p FROM PlacePhoto p
            WHERE p.place.id = :placeId
              AND (
                p.visibility = com.filmroad.api.domain.place.PhotoVisibility.PUBLIC
                OR (p.user IS NOT NULL AND p.user.id = :viewerId)
                OR (p.visibility = com.filmroad.api.domain.place.PhotoVisibility.FOLLOWERS
                    AND p.user IS NOT NULL
                    AND p.user.id IN (SELECT f.followee.id FROM UserFollow f WHERE f.follower.id = :viewerId))
              )
            ORDER BY p.createdAt DESC
            """,
            countQuery = """
            SELECT COUNT(p) FROM PlacePhoto p
            WHERE p.place.id = :placeId
              AND (
                p.visibility = com.filmroad.api.domain.place.PhotoVisibility.PUBLIC
                OR (p.user IS NOT NULL AND p.user.id = :viewerId)
                OR (p.visibility = com.filmroad.api.domain.place.PhotoVisibility.FOLLOWERS
                    AND p.user IS NOT NULL
                    AND p.user.id IN (SELECT f.followee.id FROM UserFollow f WHERE f.follower.id = :viewerId))
              )
            """)
    Page<PlacePhoto> findByPlaceIdOrderByCreatedAtDesc(@Param("placeId") Long placeId,
                                                       @Param("viewerId") Long viewerId,
                                                       Pageable pageable);

    @Query(value = """
            SELECT p FROM PlacePhoto p
            WHERE p.place.id = :placeId
              AND (
                p.visibility = com.filmroad.api.domain.place.PhotoVisibility.PUBLIC
                OR (p.user IS NOT NULL AND p.user.id = :viewerId)
                OR (p.visibility = com.filmroad.api.domain.place.PhotoVisibility.FOLLOWERS
                    AND p.user IS NOT NULL
                    AND p.user.id IN (SELECT f.followee.id FROM UserFollow f WHERE f.follower.id = :viewerId))
              )
            ORDER BY p.orderIndex DESC, p.id DESC
            """,
            countQuery = """
            SELECT COUNT(p) FROM PlacePhoto p
            WHERE p.place.id = :placeId
              AND (
                p.visibility = com.filmroad.api.domain.place.PhotoVisibility.PUBLIC
                OR (p.user IS NOT NULL AND p.user.id = :viewerId)
                OR (p.visibility = com.filmroad.api.domain.place.PhotoVisibility.FOLLOWERS
                    AND p.user IS NOT NULL
                    AND p.user.id IN (SELECT f.followee.id FROM UserFollow f WHERE f.follower.id = :viewerId))
              )
            """)
    Page<PlacePhoto> findByPlaceIdOrderByOrderIndexDescIdDesc(@Param("placeId") Long placeId,
                                                              @Param("viewerId") Long viewerId,
                                                              Pageable pageable);

    long countByPlaceId(Long placeId);

    /**
     * Place 의 viewer 가 실제로 볼 수 있는 사진 수 (PUBLIC + 본인 비공개 + 팔로워-only).
     * `findByPlaceIdOrderByOrderIndexDescIdDesc` 와 같은 visibility 규칙을 따른다 —
     * 디테일 헤더의 "인증샷 N" chip 이 노출되는 갤러리와 같은 수를 보여주도록.
     * Place 의 denormalized photo_count 컬럼은 업로드 시 갱신되지 않아 stale (대부분 0).
     * 익명 viewer 는 viewerId=null 로 호출하면 PUBLIC 만 카운트된다.
     */
    @Query("""
            SELECT COUNT(p) FROM PlacePhoto p
            WHERE p.place.id = :placeId
              AND (
                p.visibility = com.filmroad.api.domain.place.PhotoVisibility.PUBLIC
                OR (p.user IS NOT NULL AND p.user.id = :viewerId)
                OR (p.visibility = com.filmroad.api.domain.place.PhotoVisibility.FOLLOWERS
                    AND p.user IS NOT NULL
                    AND p.user.id IN (SELECT f.followee.id FROM UserFollow f WHERE f.follower.id = :viewerId))
              )
            """)
    long countVisibleByPlaceId(@Param("placeId") Long placeId, @Param("viewerId") Long viewerId);

    /**
     * 여러 placeId 에 대한 viewer-visible 사진 수를 한 번에 조회. 컬렉션 상세
     * 같이 N 개 place 를 한 응답에 담을 때 N+1 쿼리 방지용. count==0 인 place
     * 는 결과에 포함되지 않으므로 호출자가 LEFT-JOIN 시맨틱(없으면 0) 으로
     * Map 만들어 사용.
     */
    @Query("""
            SELECT p.place.id, COUNT(p) FROM PlacePhoto p
            WHERE p.place.id IN :placeIds
              AND (
                p.visibility = com.filmroad.api.domain.place.PhotoVisibility.PUBLIC
                OR (p.user IS NOT NULL AND p.user.id = :viewerId)
                OR (p.visibility = com.filmroad.api.domain.place.PhotoVisibility.FOLLOWERS
                    AND p.user IS NOT NULL
                    AND p.user.id IN (SELECT f.followee.id FROM UserFollow f WHERE f.follower.id = :viewerId))
              )
            GROUP BY p.place.id
            """)
    java.util.List<Object[]> countVisibleByPlaceIds(@Param("placeIds") java.util.Collection<Long> placeIds,
                                                     @Param("viewerId") Long viewerId);

    /**
     * 유저 본인 업로드 사진 목록 (ProfilePage 인증샷 grid 용). visibility 무관 — 본인은 전부 볼 수 있음.
     * `cursor` 보다 id 가 작은 것부터 — cursor 기반 페이지네이션 (null 이면 첫 페이지).
     * Place + Content JOIN FETCH 로 ProfilePage 에 필요한 contentTitle/placeName 을 같이 로드.
     */
    @Query("""
            SELECT p FROM PlacePhoto p
            JOIN FETCH p.place pl
            JOIN FETCH pl.content w
            WHERE p.user.id = :userId
              AND (:cursor IS NULL OR p.id < :cursor)
            ORDER BY p.id DESC
            """)
    List<PlacePhoto> findByUserIdOrderByIdDesc(@Param("userId") Long userId,
                                               @Param("cursor") Long cursor,
                                               Pageable pageable);

    /**
     * 다른 유저의 공개 프로필 grid 용. viewer 기준 visibility 필터(PUBLIC / 본인 / FOLLOWERS+팔로우)
     * 을 적용해 owner 의 사진 중 viewer 가 볼 수 있는 것만 id DESC 로 반환.
     */
    @Query("""
            SELECT p FROM PlacePhoto p
            JOIN FETCH p.place pl
            JOIN FETCH pl.content w
            WHERE p.user.id = :ownerId
              AND (
                p.visibility = com.filmroad.api.domain.place.PhotoVisibility.PUBLIC
                OR (:viewerId IS NOT NULL AND p.user.id = :viewerId)
                OR (p.visibility = com.filmroad.api.domain.place.PhotoVisibility.FOLLOWERS
                    AND :viewerId IS NOT NULL
                    AND p.user.id IN (SELECT f.followee.id FROM UserFollow f WHERE f.follower.id = :viewerId))
              )
            ORDER BY p.id DESC
            """)
    List<PlacePhoto> findVisibleByOwnerIdOrderByIdDesc(@Param("ownerId") Long ownerId,
                                                      @Param("viewerId") Long viewerId,
                                                      Pageable pageable);

    /**
     * 유저가 사진을 올린 적이 있는 place id 집합을 batch 로 반환. 컬렉션 상세의 "인증" 판정에 사용.
     */
    @Query("SELECT DISTINCT p.place.id FROM PlacePhoto p WHERE p.user.id = :userId AND p.place.id IN :placeIds")
    List<Long> findDistinctPlaceIdsByUserIdAndPlaceIdIn(@Param("userId") Long userId,
                                                       @Param("placeIds") java.util.Collection<Long> placeIds);

    @Query("""
            SELECT p FROM PlacePhoto p
            JOIN FETCH p.place pl
            JOIN FETCH pl.content w
            LEFT JOIN FETCH p.user u
            WHERE (:contentId IS NULL OR w.id = :contentId)
              AND (:placeId IS NULL OR pl.id = :placeId)
              AND (:cursor IS NULL OR p.id < :cursor)
              AND (
                p.visibility = com.filmroad.api.domain.place.PhotoVisibility.PUBLIC
                OR (p.user IS NOT NULL AND p.user.id = :viewerId)
                OR (p.visibility = com.filmroad.api.domain.place.PhotoVisibility.FOLLOWERS
                    AND p.user IS NOT NULL
                    AND p.user.id IN (SELECT f.followee.id FROM UserFollow f WHERE f.follower.id = :viewerId))
              )
            ORDER BY p.likeCount DESC, p.id DESC
            """)
    List<PlacePhoto> findFeedPopular(@Param("contentId") Long contentId,
                                     @Param("placeId") Long placeId,
                                     @Param("cursor") Long cursor,
                                     @Param("viewerId") Long viewerId,
                                     Pageable pageable);

    @Query("""
            SELECT p FROM PlacePhoto p
            JOIN FETCH p.place pl
            JOIN FETCH pl.content w
            LEFT JOIN FETCH p.user u
            WHERE (:contentId IS NULL OR w.id = :contentId)
              AND (:placeId IS NULL OR pl.id = :placeId)
              AND (:cursor IS NULL OR p.id < :cursor)
              AND (
                p.visibility = com.filmroad.api.domain.place.PhotoVisibility.PUBLIC
                OR (p.user IS NOT NULL AND p.user.id = :viewerId)
                OR (p.visibility = com.filmroad.api.domain.place.PhotoVisibility.FOLLOWERS
                    AND p.user IS NOT NULL
                    AND p.user.id IN (SELECT f.followee.id FROM UserFollow f WHERE f.follower.id = :viewerId))
              )
            ORDER BY p.id DESC
            """)
    List<PlacePhoto> findFeedRecent(@Param("contentId") Long contentId,
                                    @Param("placeId") Long placeId,
                                    @Param("cursor") Long cursor,
                                    @Param("viewerId") Long viewerId,
                                    Pageable pageable);

    /**
     * FOLLOWING 탭 — 팔로우 대상 작가의 사진만. 이미 팔로우 관계라 FOLLOWERS 공개는 볼 수 있지만,
     * PRIVATE 은 여전히 제외해야 함 (본인만 볼 수 있으니).
     */
    @Query("""
            SELECT p FROM PlacePhoto p
            JOIN FETCH p.place pl
            JOIN FETCH pl.content w
            LEFT JOIN FETCH p.user u
            WHERE p.user.id IN (SELECT f.followee.id FROM UserFollow f WHERE f.follower.id = :followerId)
              AND (:contentId IS NULL OR w.id = :contentId)
              AND (:placeId IS NULL OR pl.id = :placeId)
              AND (:cursor IS NULL OR p.id < :cursor)
              AND p.visibility <> com.filmroad.api.domain.place.PhotoVisibility.PRIVATE
            ORDER BY p.id DESC
            """)
    List<PlacePhoto> findFeedByFollowedUsers(@Param("followerId") Long followerId,
                                             @Param("contentId") Long contentId,
                                             @Param("placeId") Long placeId,
                                             @Param("cursor") Long cursor,
                                             Pageable pageable);
}
