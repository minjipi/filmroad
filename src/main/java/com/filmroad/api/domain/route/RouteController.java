package com.filmroad.api.domain.route;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.route.dto.DirectionsRequest;
import com.filmroad.api.domain.route.dto.DirectionsResponse;
import com.filmroad.api.domain.route.dto.RouteCreateRequest;
import com.filmroad.api.domain.route.dto.RouteInitResponse;
import com.filmroad.api.domain.route.dto.RouteResponse;
import com.filmroad.api.domain.route.dto.RouteSummaryDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/route")
@RequiredArgsConstructor
public class RouteController {

    private final RouteService routeService;
    private final RouteCrudService routeCrudService;

    /* --------------------------------- task #8: directions --------------------------------- */

    @Operation(summary = "카카오 모빌리티 directions 프록시",
            description = "출발/경유/도착 좌표로 운전 경로(폴리라인 + 거리/시간)를 가져온다. "
                    + "키 미설정/장애 시 available=false 로 응답.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "정상 응답 (available=false 포함)"),
            @ApiResponse(responseCode = "400", description = "좌표 범위 위반 또는 waypoints 30개 초과")
    })
    @PostMapping("/directions")
    public BaseResponse<DirectionsResponse> getDirections(@Valid @RequestBody DirectionsRequest request) {
        return BaseResponse.success(routeService.getDirections(request));
    }

    /* --------------------------------- task #10: init + CRUD --------------------------------- */

    @Operation(summary = "코스 init — content 기반 추천 후보",
            description = "content 의 장소들을 durationMin=60 기본값으로 RouteCreateRequest 에 그대로 채울 수 있도록 내려준다. 비로그인 OK.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "정상 응답"),
            @ApiResponse(responseCode = "404", description = "존재하지 않는 contentId")
    })
    @GetMapping("/init")
    public BaseResponse<RouteInitResponse> initFromContent(@RequestParam("contentId") Long contentId) {
        return BaseResponse.success(routeCrudService.initFromContent(contentId));
    }

    @Operation(summary = "코스 저장",
            description = "items 는 비어있을 수 없고 orderIndex 는 0..n-1 연속 정수.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "{ id }"),
            @ApiResponse(responseCode = "400", description = "validation 실패 / orderIndex 비연속"),
            @ApiResponse(responseCode = "401", description = "미인증"),
            @ApiResponse(responseCode = "404", description = "존재하지 않는 placeId/contentId")
    })
    @PostMapping
    public BaseResponse<Map<String, Long>> createRoute(@Valid @RequestBody RouteCreateRequest request) {
        Long id = routeCrudService.createRoute(request);
        return BaseResponse.success(Map.of("id", id));
    }

    @Operation(summary = "내 코스 목록", description = "updatedAt DESC")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "정상 응답"),
            @ApiResponse(responseCode = "401", description = "미인증")
    })
    @GetMapping("/me")
    public BaseResponse<List<RouteSummaryDto>> listMyRoutes() {
        return BaseResponse.success(routeCrudService.listMyRoutes());
    }

    @Operation(summary = "코스 단건 조회 (본인만)",
            description = "본인 외에는 403 ROUTE_FORBIDDEN, 없으면 404 ROUTE_NOT_FOUND.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "정상 응답"),
            @ApiResponse(responseCode = "401", description = "미인증"),
            @ApiResponse(responseCode = "403", description = "본인 외 접근"),
            @ApiResponse(responseCode = "404", description = "존재하지 않는 코스")
    })
    @GetMapping("/{id}")
    public BaseResponse<RouteResponse> getRoute(@PathVariable Long id) {
        return BaseResponse.success(routeCrudService.getRoute(id));
    }

    @Operation(summary = "코스 수정 (본인만)",
            description = "items 를 통째 교체. 기존 RoutePlace 는 orphanRemoval 로 제거.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "수정 후 코스 상세"),
            @ApiResponse(responseCode = "400", description = "validation 실패 / orderIndex 비연속"),
            @ApiResponse(responseCode = "401", description = "미인증"),
            @ApiResponse(responseCode = "403", description = "본인 외 접근"),
            @ApiResponse(responseCode = "404", description = "존재하지 않는 코스/placeId/contentId")
    })
    @PutMapping("/{id}")
    public BaseResponse<RouteResponse> updateRoute(@PathVariable Long id,
                                                   @Valid @RequestBody RouteCreateRequest request) {
        return BaseResponse.success(routeCrudService.updateRoute(id, request));
    }

    @Operation(summary = "코스 삭제 (본인만)")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "삭제 성공"),
            @ApiResponse(responseCode = "401", description = "미인증"),
            @ApiResponse(responseCode = "403", description = "본인 외 접근"),
            @ApiResponse(responseCode = "404", description = "존재하지 않는 코스")
    })
    @DeleteMapping("/{id}")
    public BaseResponse<Void> deleteRoute(@PathVariable Long id) {
        routeCrudService.deleteRoute(id);
        return BaseResponse.success(null);
    }
}
