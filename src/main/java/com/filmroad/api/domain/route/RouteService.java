package com.filmroad.api.domain.route;

import com.filmroad.api.domain.route.dto.DirectionsRequest;
import com.filmroad.api.domain.route.dto.DirectionsResponse;
import com.filmroad.api.domain.route.dto.LatLngDto;
import com.filmroad.api.integration.kakao.KakaoMobilityClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * 카카오 모빌리티 directions 프록시.
 *
 * <p>키 미설정/장애 시 {@link DirectionsResponse#unavailable()} 로 빈 응답을 만들어 200
 * 으로 내보낸다 (프론트가 polyline 없이 자연스럽게 폴백).</p>
 */
@Service
@RequiredArgsConstructor
public class RouteService {

    private final KakaoMobilityClient kakaoMobilityClient;

    public DirectionsResponse getDirections(DirectionsRequest request) {
        KakaoMobilityClient.LatLng origin = request.getOrigin().toClientCoord();
        KakaoMobilityClient.LatLng destination = request.getDestination().toClientCoord();

        List<KakaoMobilityClient.LatLng> waypoints = request.getWaypoints() == null
                ? Collections.emptyList()
                : request.getWaypoints().stream().map(LatLngDto::toClientCoord).toList();

        Optional<KakaoMobilityClient.MobilityRoute> result =
                kakaoMobilityClient.getDirections(origin, destination, waypoints);

        if (result.isEmpty()) {
            return DirectionsResponse.unavailable();
        }

        KakaoMobilityClient.MobilityRoute route = result.get();
        List<List<LatLngDto>> sectionsDto = route.sections().stream()
                .map(sec -> sec.stream().map(LatLngDto::from).toList())
                .toList();
        return DirectionsResponse.builder()
                .available(true)
                .path(route.path().stream().map(LatLngDto::from).toList())
                .sections(sectionsDto)
                .distanceMeters(route.distanceMeters())
                .durationSec(route.durationSec())
                .build();
    }
}
