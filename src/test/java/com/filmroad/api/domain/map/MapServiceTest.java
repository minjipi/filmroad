package com.filmroad.api.domain.map;

import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.map.dto.MapMarkerDto;
import com.filmroad.api.domain.map.dto.MapResponse;
import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceRepository;
import com.filmroad.api.domain.work.Work;
import com.filmroad.api.domain.work.WorkRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * MapService 자체를 HTTP 레이어 없이 직접 호출해 bbox 필터를 검증.
 * 시드 data.sql 의 Place 좌표를 fixture 로 사용.
 *   - 서울권:    13 이태원 (37.5347,126.9947), 14 덕수궁 (37.5658,126.9751), 16 녹사평 (37.5345,126.9881)
 *   - 바깥:      10 강릉   (37.8928,128.8347), 11 논산,  12/15 포항, 17 합천
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class MapServiceTest {

    @Autowired
    private MapService mapService;

    @Autowired
    private PlaceRepository placeRepository;

    @Autowired
    private WorkRepository workRepository;

    @AfterEach
    void restoreLimits() {
        // ReflectionTestUtils 로 mutated 한 경우를 대비해 매번 기본값 복원 (Spring 싱글턴이므로 세션 공유).
        ReflectionTestUtils.setField(mapService, "boundedMarkerLimit", 2000);
        ReflectionTestUtils.setField(mapService, "nationwideMarkerLimit", 500);
    }

    @Test
    @DisplayName("bounds 전부 null 이면 기존 동작 유지: 전국 시드 마커 모두 포함")
    void getMap_noBounds_returnsNationwide() {
        MapResponse res = mapService.getMap(null, null, null, null, null,
                null, null, null, null);

        List<Long> ids = res.getMarkers().stream().map(MapMarkerDto::getId).toList();
        // 서울권 + 지방 시드가 섞여 있어야 한다.
        assertThat(ids).contains(10L, 13L, 14L, 16L, 17L);
    }

    @Test
    @DisplayName("bbox 안/밖 분리: Seoul bbox 전달 시 내부 place 만 반환")
    void getMap_withSeoulBounds_filtersToViewport() {
        MapResponse res = mapService.getMap(null, null, null, null, null,
                37.4, 126.9, 37.7, 127.1);

        List<Long> ids = res.getMarkers().stream().map(MapMarkerDto::getId).toList();
        assertThat(ids).containsExactlyInAnyOrder(13L, 14L, 16L);
        assertThat(ids).doesNotContain(10L, 11L, 12L, 15L, 17L);
    }

    @Test
    @DisplayName("bbox 밖 selectedId 는 markers 에 없어도 selected 로 load (딥링크 보호)")
    void getMap_withBoundsAndDeepLinkedSelected_stillReturnsSelected() {
        MapResponse res = mapService.getMap(null, null, null, null, 10L,
                37.4, 126.9, 37.7, 127.1);

        assertThat(res.getSelected()).isNotNull();
        assertThat(res.getSelected().getId()).isEqualTo(10L);
        List<Long> ids = res.getMarkers().stream().map(MapMarkerDto::getId).toList();
        assertThat(ids).doesNotContain(10L);
    }

    @Test
    @DisplayName("sw/ne 역순이면 REQUEST_ERROR(30001) BaseException throw")
    void getMap_withSwappedBounds_throws() {
        assertThatThrownBy(() -> mapService.getMap(null, null, null, null, null,
                37.9, 127.2, 37.5, 126.9))
                .isInstanceOf(BaseException.class)
                .extracting(e -> ((BaseException) e).getStatus())
                .isEqualTo(BaseResponseStatus.REQUEST_ERROR);
    }

    @Test
    @DisplayName("bbox 일부만 전달(swLat 만) 이면 필터 비활성, 기존 전국 동작")
    void getMap_withPartialBounds_isIgnored() {
        MapResponse res = mapService.getMap(null, null, null, null, null,
                37.4, null, null, null);

        List<Long> ids = res.getMarkers().stream().map(MapMarkerDto::getId).toList();
        assertThat(ids).contains(10L, 17L); // 바깥 시드도 포함되면 bbox 비활성 증거
    }

    @Test
    @DisplayName("bbox 경로는 boundedMarkerLimit 을 적용 (nationwide 와 독립적으로 동작)")
    void getMap_boundedLimit_appliesToBboxPath() {
        // 기본 2000 대신 1 로 낮춰 Seoul bbox 의 3개 place 중 1개만 잘라 내려오는지 확인.
        ReflectionTestUtils.setField(mapService, "boundedMarkerLimit", 1);

        MapResponse res = mapService.getMap(null, null, null, null, null,
                37.4, 126.9, 37.7, 127.1);

        assertThat(res.getMarkers()).hasSize(1);
        // nationwide 경로에는 영향 없음. nationwideMarkerLimit 기본값 500 이 적용돼 전국 시드 모두 반환.
        MapResponse nationwide = mapService.getMap(null, null, null, null, null,
                null, null, null, null);
        assertThat(nationwide.getMarkers().size()).isGreaterThanOrEqualTo(5);
    }


    @Test
    @DisplayName("bbox 내 place 가 trendingScore 낮아도 잘리지 않음 (옛 trending-우선 limit 회귀 방어)")
    void getMap_bbox_doesNotDropLowTrendingPlacesInViewport() {
        // 시드 외에 Seoul bbox 에 trendingScore=1 인 저인기 장소 1개 추가. id ASC 순으로 마지막에 와야 함.
        Work work = workRepository.findById(1L).orElseThrow();
        Place cameo = placeRepository.save(Place.builder()
                .name("부암동 카페 (테스트)")
                .regionLabel("서울 종로구 부암동")
                .latitude(37.59)
                .longitude(126.97)
                .work(work)
                .trendingScore(1)
                .photoCount(0)
                .likeCount(0)
                .rating(0)
                .nearbyRestaurantCount(0)
                .reviewCount(0)
                .build());

        // nationwideMarkerLimit=3 으로 낮춰 "전국 경로면 trending DESC 로 상위 3개만 남아 cameo 는 탈락" 상황 연출.
        ReflectionTestUtils.setField(mapService, "nationwideMarkerLimit", 3);

        // 전국 뷰: trending DESC 라서 cameo(trendingScore=1)는 상위 3개에 못 든다.
        MapResponse nationwide = mapService.getMap(null, null, null, null, null,
                null, null, null, null);
        List<Long> nationwideIds = nationwide.getMarkers().stream().map(MapMarkerDto::getId).toList();
        assertThat(nationwideIds).doesNotContain(cameo.getId());

        // Seoul bbox 뷰: bbox 경로는 trendingScore 무시 + 넉넉한 limit 이라 cameo 가 포함돼야 함.
        MapResponse seoul = mapService.getMap(null, null, null, null, null,
                37.4, 126.9, 37.7, 127.1);
        List<Long> seoulIds = seoul.getMarkers().stream().map(MapMarkerDto::getId).toList();
        assertThat(seoulIds).contains(cameo.getId(), 13L, 14L, 16L);
    }

    @Test
    @DisplayName("전국 경로는 nationwideMarkerLimit 을 적용 (bounded 와 독립적으로 동작)")
    void getMap_nationwideLimit_appliesOnlyToNationwidePath() {
        ReflectionTestUtils.setField(mapService, "nationwideMarkerLimit", 1);

        MapResponse nationwide = mapService.getMap(null, null, null, null, null,
                null, null, null, null);
        assertThat(nationwide.getMarkers()).hasSize(1);

        // bbox 경로는 기본 2000 유지 → Seoul bbox 3개 모두 반환돼야 한다.
        MapResponse seoul = mapService.getMap(null, null, null, null, null,
                37.4, 126.9, 37.7, 127.1);
        assertThat(seoul.getMarkers()).hasSize(3);
    }
}
