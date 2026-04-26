package com.filmroad.api.domain.follow;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.follow.dto.FollowListResponse;
import com.filmroad.api.domain.follow.dto.FollowToggleResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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

    @GetMapping("/{id}/followers")
    public BaseResponse<FollowListResponse> followers(
            @PathVariable Long id,
            @RequestParam(required = false) Long cursor,
            @RequestParam(required = false, defaultValue = "20") int limit
    ) {
        return BaseResponse.success(followService.listFollowers(id, cursor, limit));
    }

    @GetMapping("/{id}/following")
    public BaseResponse<FollowListResponse> following(
            @PathVariable Long id,
            @RequestParam(required = false) Long cursor,
            @RequestParam(required = false, defaultValue = "20") int limit
    ) {
        return BaseResponse.success(followService.listFollowings(id, cursor, limit));
    }
}
