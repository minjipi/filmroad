package com.filmroad.api.domain.map;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.map.dto.MapResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/map")
@RequiredArgsConstructor
@Validated
public class MapController {

    private final MapService mapService;

    @GetMapping("/places")
    public BaseResponse<MapResponse> getPlaces(
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(required = false) Long workId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long selectedId
    ) {
        return BaseResponse.success(mapService.getMap(lat, lng, workId, q, selectedId));
    }
}
