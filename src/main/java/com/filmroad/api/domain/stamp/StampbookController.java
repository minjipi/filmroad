package com.filmroad.api.domain.stamp;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.stamp.dto.StampbookResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/stampbook")
@RequiredArgsConstructor
public class StampbookController {

    private final StampbookService stampbookService;

    @GetMapping
    public BaseResponse<StampbookResponse> getStampbook() {
        return BaseResponse.success(stampbookService.getStampbook());
    }
}
