package com.filmroad.api.domain.user;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.user.dto.ProfileResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
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
}
