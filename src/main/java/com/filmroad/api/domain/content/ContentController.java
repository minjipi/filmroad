package com.filmroad.api.domain.content;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.content.dto.ContentDetailResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/contents")
@RequiredArgsConstructor
public class ContentController {

    private final ContentDetailService workDetailService;

    @GetMapping("/{id}")
    public BaseResponse<ContentDetailResponse> getContent(@PathVariable Long id) {
        return BaseResponse.success(workDetailService.getContent(id));
    }
}
