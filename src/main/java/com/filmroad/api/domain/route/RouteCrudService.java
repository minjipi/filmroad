package com.filmroad.api.domain.route;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.content.Content;
import com.filmroad.api.domain.content.ContentRepository;
import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceRepository;
import com.filmroad.api.domain.route.dto.RouteCreateRequest;
import com.filmroad.api.domain.route.dto.RouteInitContentDto;
import com.filmroad.api.domain.route.dto.RouteInitPlaceDto;
import com.filmroad.api.domain.route.dto.RouteInitResponse;
import com.filmroad.api.domain.route.dto.RouteItemRequest;
import com.filmroad.api.domain.route.dto.RouteResponse;
import com.filmroad.api.domain.route.dto.RouteSummaryDto;
import com.filmroad.api.domain.stamp.Stamp;
import com.filmroad.api.domain.stamp.StampRepository;
import com.filmroad.api.domain.user.User;
import com.filmroad.api.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Route 의 init / CRUD 비즈니스 로직.
 *
 * <p>init 은 비로그인도 호출 가능 — 콘텐츠 + 추천 장소만 내려준다. 저장/조회/수정/삭제는
 * 모두 본인 가드. 본인 외 user 가 조회하면 {@link BaseResponseStatus#ROUTE_FORBIDDEN}.</p>
 */
@Service
@RequiredArgsConstructor
public class RouteCrudService {

    private static final String DEFAULT_START_TIME = "09:00";
    private static final int DEFAULT_DURATION_MIN = 60;

    private final RouteRepository routeRepository;
    private final PlaceRepository placeRepository;
    private final ContentRepository contentRepository;
    private final UserRepository userRepository;
    private final StampRepository stampRepository;
    private final CurrentUser currentUser;

    @Transactional(readOnly = true)
    public RouteInitResponse initFromContent(Long contentId) {
        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.CONTENT_NOT_FOUND));

        List<Place> places = placeRepository.findByContentIdOrderByIdAsc(contentId);

        // 비로그인 (currentUserIdOrNull == null) 이면 빈 맵 → 모든 place 가 visited=false.
        // 로그인 상태면 콘텐츠 단위로 stamp 1 회 조회 (N+1 free).
        Long userId = currentUser.currentUserIdOrNull();
        Map<Long, Stamp> stampByPlaceId = userId == null
                ? Collections.emptyMap()
                : indexStamps(stampRepository.findByUserIdAndContentId(userId, contentId));

        return RouteInitResponse.builder()
                .content(RouteInitContentDto.from(content))
                .suggestedName(content.getTitle() + " 코스")
                .suggestedStartTime(DEFAULT_START_TIME)
                .places(places.stream()
                        .map(p -> RouteInitPlaceDto.from(p, stampByPlaceId.get(p.getId())))
                        .toList())
                .build();
    }

    /** placeId → Stamp 매핑. 동일 (user, place) 는 stamp 유니크 제약상 1건이지만 안전한 merge. */
    private static Map<Long, Stamp> indexStamps(List<Stamp> stamps) {
        Map<Long, Stamp> map = new HashMap<>(stamps.size());
        for (Stamp s : stamps) {
            map.put(s.getPlace().getId(), s);
        }
        return map;
    }

    @Transactional
    public Long createRoute(RouteCreateRequest request) {
        Long userId = currentUser.currentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.USER_NOT_FOUND));

        Content content = resolveContent(request.getContentId());
        Map<Long, Place> placeMap = loadPlaces(request.getItems());
        validateOrderIndex(request.getItems());

        Route route = Route.builder()
                .user(user)
                .content(content)
                .name(request.getName())
                .startTime(request.getStartTime())
                .build();

        route.replacePlaces(buildRoutePlaces(request.getItems(), placeMap));

        Route saved = routeRepository.save(route);
        return saved.getId();
    }

    @Transactional(readOnly = true)
    public RouteResponse getRoute(Long routeId) {
        Long userId = currentUser.currentUserId();
        Route route = routeRepository.findById(routeId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.ROUTE_NOT_FOUND));
        ensureOwner(route, userId);
        return RouteResponse.from(route, ownerStamps(route, userId));
    }

    @Transactional(readOnly = true)
    public List<RouteSummaryDto> listMyRoutes() {
        Long userId = currentUser.currentUserId();
        return routeRepository.findByUserIdOrderByUpdatedAtDesc(userId).stream()
                .map(RouteSummaryDto::from)
                .toList();
    }

    @Transactional
    public RouteResponse updateRoute(Long routeId, RouteCreateRequest request) {
        Long userId = currentUser.currentUserId();
        Route route = routeRepository.findById(routeId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.ROUTE_NOT_FOUND));
        ensureOwner(route, userId);

        Content content = resolveContent(request.getContentId());
        Map<Long, Place> placeMap = loadPlaces(request.getItems());
        validateOrderIndex(request.getItems());

        route.updateMeta(request.getName(), request.getStartTime(), content);
        // Hibernate 의 default flush 순서는 INSERT 먼저, DELETE 나중. 한 트랜잭션에서
        // places 를 통째 교체하면 `(route_id, order_index)` 유니크 제약과 충돌한다.
        // clearPlaces → flush → addPlaces 로 쪼개 orphan 삭제를 먼저 DB 에 반영.
        List<RoutePlace> newPlaces = buildRoutePlaces(request.getItems(), placeMap);
        route.clearPlaces();
        routeRepository.flush();
        route.addPlaces(newPlaces);

        return RouteResponse.from(route, ownerStamps(route, userId));
    }

    @Transactional
    public void deleteRoute(Long routeId) {
        Long userId = currentUser.currentUserId();
        Route route = routeRepository.findById(routeId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.ROUTE_NOT_FOUND));
        ensureOwner(route, userId);
        routeRepository.delete(route);
    }

    private Content resolveContent(Long contentId) {
        if (contentId == null) return null;
        return contentRepository.findById(contentId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.CONTENT_NOT_FOUND));
    }

    private Map<Long, Place> loadPlaces(List<RouteItemRequest> items) {
        Set<Long> placeIds = new HashSet<>();
        for (RouteItemRequest it : items) {
            placeIds.add(it.getPlaceId());
        }
        List<Place> places = placeRepository.findAllById(placeIds);
        if (places.size() != placeIds.size()) {
            throw BaseException.of(BaseResponseStatus.PLACE_NOT_FOUND);
        }
        Map<Long, Place> map = new HashMap<>(places.size());
        for (Place p : places) {
            map.put(p.getId(), p);
        }
        return map;
    }

    /**
     * orderIndex 가 0..n-1 연속 정수인지 검증. 중복 / 누락 / 음수 / n 초과 모두 거부.
     */
    private void validateOrderIndex(List<RouteItemRequest> items) {
        int n = items.size();
        boolean[] seen = new boolean[n];
        for (RouteItemRequest it : items) {
            int idx = it.getOrderIndex();
            if (idx < 0 || idx >= n || seen[idx]) {
                throw BaseException.of(BaseResponseStatus.ROUTE_INVALID_ITEMS);
            }
            seen[idx] = true;
        }
    }

    private List<RoutePlace> buildRoutePlaces(List<RouteItemRequest> items, Map<Long, Place> placeMap) {
        List<RoutePlace> result = new ArrayList<>(items.size());
        for (RouteItemRequest it : items) {
            Place place = placeMap.get(it.getPlaceId());
            int duration = it.getDurationMin() == null ? DEFAULT_DURATION_MIN : it.getDurationMin();
            result.add(RoutePlace.builder()
                    .place(place)
                    .orderIndex(it.getOrderIndex())
                    .durationMin(duration)
                    .note(it.getNote())
                    .build());
        }
        return result;
    }

    private void ensureOwner(Route route, Long userId) {
        if (!route.getUser().getId().equals(userId)) {
            throw BaseException.of(BaseResponseStatus.ROUTE_FORBIDDEN);
        }
    }

    /**
     * 코스 소유자의 stamp 를 한 번에 batch 조회. 빈 places 면 외부 호출 없이 빈 맵.
     */
    private Map<Long, Stamp> ownerStamps(Route route, Long userId) {
        if (route.getPlaces().isEmpty()) {
            return Collections.emptyMap();
        }
        Set<Long> placeIds = new HashSet<>(route.getPlaces().size());
        for (RoutePlace rp : route.getPlaces()) {
            placeIds.add(rp.getPlace().getId());
        }
        return indexStamps(stampRepository.findByUserIdAndPlaceIdIn(userId, placeIds));
    }
}
