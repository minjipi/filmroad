package com.filmroad.api.domain.follow;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.follow.dto.FollowToggleResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Validated
public class FollowController {

    private final FollowService followService;

    @PostMapping("/{id}/follow")
    public BaseResponse<FollowToggleResponse> toggle(@PathVariable Long id) {
        return BaseResponse.success(followService.toggleFollow(id));
    }
}
