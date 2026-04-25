package com.filmroad.api.domain.home;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.home.dto.HomeResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/home")
@RequiredArgsConstructor
@Validated
public class HomeController {

    private final HomeService homeService;

    @GetMapping
    public BaseResponse<HomeResponse> getHome(
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(required = false) Double radiusKm,
            @RequestParam(required = false) Long workId,
            @RequestParam(required = false) HomeScope scope
    ) {
        return BaseResponse.success(homeService.getHome(lat, lng, radiusKm, workId, scope));
    }
}
