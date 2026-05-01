package com.filmroad.api.domain.congestion;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.congestion.dto.CongestionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 한국관광공사 TatsCnctrRateService 기반 관광지 혼잡도 예측 — PlaceDetailPage 용 프록시.
 *
 * <p>permitAll — 좋아요/저장 같은 사용자별 데이터가 아니라 위치 기반 공개 정보. 매핑/외부 API
 * 실패 시에도 200 + {@code available=false} 로 응답해 프론트가 섹션을 자연스럽게 숨길 수
 * 있게 한다 (KakaoSection 과 동일 정책).</p>
 */
@RestController
@RequestMapping("/api/places")
@RequiredArgsConstructor
public class CongestionController {

    private final CongestionService congestionService;

    @Operation(summary = "장소 혼잡도 예측 조회 (한국관광공사 API 프록시)",
            description = "PlaceDetailPage 의 혼잡도 섹션 데이터. 오늘/내일/이번 주말 3건. " +
                    "매핑 실패 / 외부 API 미설정·장애 시 available=false 응답.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "정상 응답 (available=false 포함)"),
            @ApiResponse(responseCode = "404", description = "존재하지 않는 placeId")
    })
    @GetMapping("/{id}/congestion")
    public BaseResponse<CongestionResponse> getCongestion(@PathVariable Long id) {
        return BaseResponse.success(congestionService.getCongestion(id));
    }
}
