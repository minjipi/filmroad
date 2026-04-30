package com.filmroad.api.domain.route;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RouteRepository extends JpaRepository<Route, Long> {

    /**
     * 내 코스 목록. updatedAt DESC. 카드 썸네일은 places.place.coverImages 가 필요한데
     * Place.coverImages / sceneImages 가 List 라 동시 fetch 시 Hibernate 의 MultipleBagFetchException
     * 이 발생. 따라서 entity graph 는 places + places.place 까지만 끌어오고, coverImages 는
     * Service 의 @Transactional 안에서 lazy 로 해결한다 (요약 카드는 1번째 place 의 cover 만 필요).
     */
    @EntityGraph(attributePaths = {"content", "places", "places.place"})
    List<Route> findByUserIdOrderByUpdatedAtDesc(Long userId);

    /**
     * 단건 조회 — 본인 권한 가드는 Service 에서 user 비교로 처리. 상세 응답에서 places 의
     * cover/scene URL 들이 필요하지만 같은 MultipleBagFetchException 이슈로 그래프는
     * places.place 까지만. URL 들은 Service @Transactional 안의 lazy 로 풀림.
     */
    @EntityGraph(attributePaths = {"user", "content", "places", "places.place"})
    Optional<Route> findById(Long id);
}
