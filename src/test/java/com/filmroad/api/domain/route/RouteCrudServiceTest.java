package com.filmroad.api.domain.route;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.content.Content;
import com.filmroad.api.domain.content.ContentRepository;
import com.filmroad.api.domain.content.ContentType;
import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceRepository;
import com.filmroad.api.domain.route.dto.RouteCreateRequest;
import com.filmroad.api.domain.route.dto.RouteInitResponse;
import com.filmroad.api.domain.route.dto.RouteItemRequest;
import com.filmroad.api.domain.route.dto.RouteResponse;
import com.filmroad.api.domain.user.User;
import com.filmroad.api.domain.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link RouteCrudService}. Pure Mockito — no Spring context.
 */
@ExtendWith(MockitoExtension.class)
class RouteCrudServiceTest {

    @Mock private RouteRepository routeRepository;
    @Mock private PlaceRepository placeRepository;
    @Mock private ContentRepository contentRepository;
    @Mock private UserRepository userRepository;
    @Mock private CurrentUser currentUser;

    @InjectMocks
    private RouteCrudService service;

    private User userA;
    private User userB;
    private Content content;
    private Place place10;
    private Place place11;

    @BeforeEach
    void setUp() {
        userA = User.builder().id(1L).nickname("userA").handle("@a").build();
        userB = User.builder().id(2L).nickname("userB").handle("@b").build();
        content = Content.builder()
                .id(5L)
                .title("도깨비")
                .posterUrl("https://example.com/p.jpg")
                .type(ContentType.DRAMA)
                .ratingAverage(4.8)
                .build();
        place10 = Place.builder()
                .id(10L)
                .name("주문진 영진해변 방파제")
                .regionLabel("강원 강릉시 주문진읍")
                .latitude(37.89).longitude(128.83)
                .trendingScore(0).photoCount(0).likeCount(0).rating(0).reviewCount(0).nearbyRestaurantCount(0)
                .build();
        place11 = Place.builder()
                .id(11L)
                .name("정동진역")
                .regionLabel("강원 강릉시 강동면")
                .latitude(37.69).longitude(129.03)
                .trendingScore(0).photoCount(0).likeCount(0).rating(0).reviewCount(0).nearbyRestaurantCount(0)
                .build();
    }

    @Test
    @DisplayName("init: content + 정렬된 places, 추천 이름 = \"{title} 코스\", 출발 09:00")
    void initFromContent_buildsResponse() {
        when(contentRepository.findById(5L)).thenReturn(Optional.of(content));
        when(placeRepository.findByContentIdOrderByIdAsc(5L)).thenReturn(List.of(place10, place11));

        RouteInitResponse response = service.initFromContent(5L);

        assertThat(response.getContent().getId()).isEqualTo(5L);
        assertThat(response.getContent().getTitle()).isEqualTo("도깨비");
        assertThat(response.getSuggestedName()).isEqualTo("도깨비 코스");
        assertThat(response.getSuggestedStartTime()).isEqualTo("09:00");
        assertThat(response.getPlaces()).hasSize(2);
        assertThat(response.getPlaces().get(0).getPlaceId()).isEqualTo(10L);
        assertThat(response.getPlaces().get(0).getDurationMin()).isEqualTo(60);
    }

    @Test
    @DisplayName("init: contentId 미존재 → CONTENT_NOT_FOUND")
    void initFromContent_unknownContent_throws() {
        when(contentRepository.findById(404L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.initFromContent(404L))
                .isInstanceOf(BaseException.class)
                .hasMessageContaining(BaseResponseStatus.CONTENT_NOT_FOUND.getMessage());
    }

    @Test
    @DisplayName("create happy: id 반환 + Route 가 user/content/places 와 함께 저장")
    void createRoute_happy_returnsId() {
        when(currentUser.currentUserId()).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(userA));
        when(contentRepository.findById(5L)).thenReturn(Optional.of(content));
        when(placeRepository.findAllById(anySet())).thenReturn(List.of(place10, place11));
        when(routeRepository.save(any(Route.class))).thenAnswer(inv -> {
            Route r = inv.getArgument(0);
            ReflectionTestUtils.setField(r, "id", 42L);
            return r;
        });

        RouteCreateRequest req = buildCreateRequest("도깨비 코스", "09:00", 5L,
                List.of(item(10L, 0, 60, "메모1"), item(11L, 1, 90, null)));

        Long id = service.createRoute(req);

        assertThat(id).isEqualTo(42L);

        ArgumentCaptor<Route> captor = ArgumentCaptor.forClass(Route.class);
        verify(routeRepository).save(captor.capture());
        Route saved = captor.getValue();
        assertThat(saved.getName()).isEqualTo("도깨비 코스");
        assertThat(saved.getStartTime()).isEqualTo("09:00");
        assertThat(saved.getUser()).isSameAs(userA);
        assertThat(saved.getContent()).isSameAs(content);
        assertThat(saved.getPlaces()).hasSize(2);
        assertThat(saved.getPlaces().get(0).getPlace().getId()).isIn(10L, 11L);
        assertThat(saved.getPlaces().stream().mapToInt(RoutePlace::getOrderIndex).sum()).isEqualTo(0 + 1);
    }

    @Test
    @DisplayName("create: contentId 없으면 자유 코스 (content=null)")
    void createRoute_noContent_buildsFreeRoute() {
        when(currentUser.currentUserId()).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(userA));
        when(placeRepository.findAllById(anySet())).thenReturn(List.of(place10));
        when(routeRepository.save(any(Route.class))).thenAnswer(inv -> {
            Route r = inv.getArgument(0);
            ReflectionTestUtils.setField(r, "id", 7L);
            return r;
        });

        RouteCreateRequest req = buildCreateRequest("자유", "10:30", null,
                List.of(item(10L, 0, 30, null)));
        Long id = service.createRoute(req);

        assertThat(id).isEqualTo(7L);
        ArgumentCaptor<Route> captor = ArgumentCaptor.forClass(Route.class);
        verify(routeRepository).save(captor.capture());
        assertThat(captor.getValue().getContent()).isNull();
    }

    @Test
    @DisplayName("create: orderIndex 비연속(0,2) → ROUTE_INVALID_ITEMS, save 호출 없음")
    void createRoute_nonContiguousOrderIndex_throws() {
        when(currentUser.currentUserId()).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(userA));
        when(placeRepository.findAllById(anySet())).thenReturn(List.of(place10, place11));

        RouteCreateRequest req = buildCreateRequest("bad", "09:00", null,
                List.of(item(10L, 0, 60, null), item(11L, 2, 60, null)));

        assertThatThrownBy(() -> service.createRoute(req))
                .isInstanceOf(BaseException.class)
                .hasMessageContaining(BaseResponseStatus.ROUTE_INVALID_ITEMS.getMessage());
        verify(routeRepository, never()).save(any());
    }

    @Test
    @DisplayName("create: 동일 orderIndex 중복 → ROUTE_INVALID_ITEMS")
    void createRoute_duplicateOrderIndex_throws() {
        when(currentUser.currentUserId()).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(userA));
        when(placeRepository.findAllById(anySet())).thenReturn(List.of(place10, place11));

        RouteCreateRequest req = buildCreateRequest("bad", "09:00", null,
                List.of(item(10L, 0, 60, null), item(11L, 0, 60, null)));

        assertThatThrownBy(() -> service.createRoute(req))
                .isInstanceOf(BaseException.class);
        verify(routeRepository, never()).save(any());
    }

    @Test
    @DisplayName("create: 존재하지 않는 placeId → PLACE_NOT_FOUND")
    void createRoute_unknownPlace_throws() {
        when(currentUser.currentUserId()).thenReturn(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(userA));
        // 요청은 2개 placeId 인데 repo 가 1개만 돌려줌 → 누락 감지.
        when(placeRepository.findAllById(anySet())).thenReturn(List.of(place10));

        RouteCreateRequest req = buildCreateRequest("bad", "09:00", null,
                List.of(item(10L, 0, 60, null), item(99L, 1, 60, null)));

        assertThatThrownBy(() -> service.createRoute(req))
                .isInstanceOf(BaseException.class)
                .hasMessageContaining(BaseResponseStatus.PLACE_NOT_FOUND.getMessage());
    }

    @Test
    @DisplayName("get: 본인 → RouteResponse, content 정보까지 응답")
    void getRoute_owner_returnsResponse() {
        when(currentUser.currentUserId()).thenReturn(1L);
        Route route = buildPersistedRoute(42L, userA, content, "코스", "09:00",
                List.of(routePlace(place10, 0, 60, "메모"), routePlace(place11, 1, 90, null)));
        when(routeRepository.findById(42L)).thenReturn(Optional.of(route));

        RouteResponse response = service.getRoute(42L);

        assertThat(response.getId()).isEqualTo(42L);
        assertThat(response.getContentId()).isEqualTo(5L);
        assertThat(response.getContentTitle()).isEqualTo("도깨비");
        assertThat(response.getItems()).hasSize(2);
        assertThat(response.getItems().get(0).getPlaceId()).isEqualTo(10L);
        assertThat(response.getItems().get(0).getDurationMin()).isEqualTo(60);
        assertThat(response.getItems().get(0).getNote()).isEqualTo("메모");
    }

    @Test
    @DisplayName("get: 타 유저 → ROUTE_FORBIDDEN")
    void getRoute_nonOwner_throws() {
        lenient().when(currentUser.currentUserId()).thenReturn(2L);
        Route route = buildPersistedRoute(42L, userA, null, "코스", "09:00", List.of());
        when(routeRepository.findById(42L)).thenReturn(Optional.of(route));

        assertThatThrownBy(() -> service.getRoute(42L))
                .isInstanceOf(BaseException.class)
                .hasMessageContaining(BaseResponseStatus.ROUTE_FORBIDDEN.getMessage());
    }

    @Test
    @DisplayName("get: 미존재 → ROUTE_NOT_FOUND")
    void getRoute_unknown_throws() {
        when(routeRepository.findById(404L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getRoute(404L))
                .isInstanceOf(BaseException.class)
                .hasMessageContaining(BaseResponseStatus.ROUTE_NOT_FOUND.getMessage());
    }

    @Test
    @DisplayName("listMyRoutes: updatedAt DESC 그대로 RouteSummaryDto 매핑")
    void listMyRoutes_returnsSummaryList() {
        when(currentUser.currentUserId()).thenReturn(1L);
        Route r1 = buildPersistedRoute(1L, userA, content, "A", "09:00",
                List.of(routePlace(place10, 0, 60, null)));
        Route r2 = buildPersistedRoute(2L, userA, null, "B", "10:00", List.of());
        when(routeRepository.findByUserIdOrderByUpdatedAtDesc(1L)).thenReturn(List.of(r1, r2));

        var list = service.listMyRoutes();
        assertThat(list).hasSize(2);
        assertThat(list.get(0).getId()).isEqualTo(1L);
        assertThat(list.get(0).getContentTitle()).isEqualTo("도깨비");
        assertThat(list.get(0).getPlaceCount()).isEqualTo(1);
        assertThat(list.get(1).getContentTitle()).isNull();
        assertThat(list.get(1).getPlaceCount()).isZero();
    }

    @Test
    @DisplayName("update: 본인 → 메타 + items 통째 교체")
    void updateRoute_owner_replacesPlaces() {
        when(currentUser.currentUserId()).thenReturn(1L);
        Route route = buildPersistedRoute(42L, userA, null, "old", "08:00",
                List.of(routePlace(place10, 0, 60, "old-note")));
        when(routeRepository.findById(42L)).thenReturn(Optional.of(route));
        when(contentRepository.findById(5L)).thenReturn(Optional.of(content));
        when(placeRepository.findAllById(anySet())).thenReturn(List.of(place10, place11));

        RouteCreateRequest req = buildCreateRequest("new", "11:00", 5L,
                List.of(item(11L, 0, 30, "new-note"), item(10L, 1, 45, null)));

        RouteResponse response = service.updateRoute(42L, req);

        assertThat(response.getName()).isEqualTo("new");
        assertThat(response.getStartTime()).isEqualTo("11:00");
        assertThat(response.getContentId()).isEqualTo(5L);
        assertThat(response.getItems()).hasSize(2);
        assertThat(response.getItems().get(0).getPlaceId()).isEqualTo(11L);
        assertThat(response.getItems().get(0).getDurationMin()).isEqualTo(30);
        assertThat(response.getItems().get(0).getNote()).isEqualTo("new-note");
    }

    @Test
    @DisplayName("update: 타 유저 → ROUTE_FORBIDDEN, 변경 없음")
    void updateRoute_nonOwner_throws() {
        lenient().when(currentUser.currentUserId()).thenReturn(2L);
        Route route = buildPersistedRoute(42L, userA, null, "old", "08:00", List.of());
        when(routeRepository.findById(42L)).thenReturn(Optional.of(route));

        RouteCreateRequest req = buildCreateRequest("new", "11:00", null,
                List.of(item(10L, 0, 30, null)));

        assertThatThrownBy(() -> service.updateRoute(42L, req))
                .isInstanceOf(BaseException.class)
                .hasMessageContaining(BaseResponseStatus.ROUTE_FORBIDDEN.getMessage());
        verify(placeRepository, never()).findAllById(anySet());
    }

    @Test
    @DisplayName("delete: 본인 → repository.delete 호출")
    void deleteRoute_owner_deletes() {
        when(currentUser.currentUserId()).thenReturn(1L);
        Route route = buildPersistedRoute(42L, userA, null, "x", "09:00", List.of());
        when(routeRepository.findById(42L)).thenReturn(Optional.of(route));

        service.deleteRoute(42L);
        verify(routeRepository).delete(route);
    }

    @Test
    @DisplayName("delete: 타 유저 → ROUTE_FORBIDDEN, repository.delete 미호출")
    void deleteRoute_nonOwner_throws() {
        lenient().when(currentUser.currentUserId()).thenReturn(2L);
        Route route = buildPersistedRoute(42L, userA, null, "x", "09:00", List.of());
        when(routeRepository.findById(42L)).thenReturn(Optional.of(route));

        assertThatThrownBy(() -> service.deleteRoute(42L))
                .isInstanceOf(BaseException.class);
        verify(routeRepository, never()).delete(any(Route.class));
    }

    /* helpers */

    private RouteCreateRequest buildCreateRequest(String name, String startTime, Long contentId,
                                                   List<RouteItemRequest> items) {
        RouteCreateRequest req = new RouteCreateRequest();
        req.setName(name);
        req.setStartTime(startTime);
        req.setContentId(contentId);
        req.setItems(items);
        return req;
    }

    private RouteItemRequest item(Long placeId, int orderIndex, int durationMin, String note) {
        RouteItemRequest it = new RouteItemRequest();
        it.setPlaceId(placeId);
        it.setOrderIndex(orderIndex);
        it.setDurationMin(durationMin);
        it.setNote(note);
        return it;
    }

    private RoutePlace routePlace(Place place, int orderIndex, int durationMin, String note) {
        return RoutePlace.builder()
                .place(place)
                .orderIndex(orderIndex)
                .durationMin(durationMin)
                .note(note)
                .build();
    }

    private Route buildPersistedRoute(Long id, User user, Content content, String name,
                                      String startTime, List<RoutePlace> places) {
        Route route = Route.builder()
                .id(id)
                .user(user)
                .content(content)
                .name(name)
                .startTime(startTime)
                .places(new ArrayList<>())
                .build();
        route.replacePlaces(places);
        ReflectionTestUtils.setField(route, "createdAt", new Date());
        ReflectionTestUtils.setField(route, "updatedAt", new Date());
        return route;
    }
}
