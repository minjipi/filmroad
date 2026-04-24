package com.filmroad.api.domain.user;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.user.dto.MyPhotosResponse;
import com.filmroad.api.domain.user.dto.ProfileResponse;
import com.filmroad.api.domain.user.dto.PublicUserProfileResponse;
import com.filmroad.api.domain.user.dto.UpdateProfileRequest;
import com.filmroad.api.domain.user.dto.UserMeDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public BaseResponse<ProfileResponse> getMe() {
        return BaseResponse.success(userService.getMe());
    }

    @PatchMapping("/me")
    public BaseResponse<UserMeDto> updateMe(@Valid @RequestBody UpdateProfileRequest req) {
        return BaseResponse.success(userService.updateMe(req));
    }

    /**
     * 내가 업로드한 인증샷 최신순 (cursor 기반 페이지네이션). limit default 30, max 60 clamp.
     * `nextCursor` 가 null 이면 끝.
     */
    @GetMapping("/me/photos")
    public BaseResponse<MyPhotosResponse> getMyPhotos(
            @RequestParam(value = "cursor", required = false) Long cursor,
            @RequestParam(value = "limit", required = false) Integer limit
    ) {
        return BaseResponse.success(userService.getMyPhotos(cursor, limit));
    }

    /**
     * 공개 프로필 (17-user-profile.html). header + stats + stampHighlights + 상위 인증샷 9개.
     * 존재하지 않으면 404 USER_NOT_FOUND.
     */
    @GetMapping("/{id}")
    public BaseResponse<PublicUserProfileResponse> getPublicProfile(@PathVariable("id") Long id) {
        return BaseResponse.success(userService.getPublicProfile(id));
    }
}
