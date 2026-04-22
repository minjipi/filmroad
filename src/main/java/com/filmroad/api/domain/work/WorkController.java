package com.filmroad.api.domain.work;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.work.dto.WorkDetailResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/works")
@RequiredArgsConstructor
public class WorkController {

    private final WorkDetailService workDetailService;

    @GetMapping("/{id}")
    public BaseResponse<WorkDetailResponse> getWork(@PathVariable Long id) {
        return BaseResponse.success(workDetailService.getWork(id));
    }
}
