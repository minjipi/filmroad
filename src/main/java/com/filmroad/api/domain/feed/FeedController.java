package com.filmroad.api.domain.feed;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.feed.dto.FeedResponse;
import com.filmroad.api.domain.feed.dto.FeedUserDto;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/feed")
@RequiredArgsConstructor
@Validated
public class FeedController {

    private final FeedService feedService;

    @GetMapping
    public BaseResponse<FeedResponse> getFeed(
            @RequestParam(required = false, defaultValue = "POPULAR") FeedTab tab,
            @RequestParam(required = false) Long workId,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(required = false) Long cursor,
            @RequestParam(required = false, defaultValue = "5") int limit
    ) {
        return BaseResponse.success(feedService.getFeed(tab, workId, lat, lng, cursor, limit));
    }

    @GetMapping("/recommended-users")
    public BaseResponse<List<FeedUserDto>> getRecommendedUsers(
            @RequestParam(required = false) Long workId,
            @RequestParam(required = false, defaultValue = "4") int limit
    ) {
        return BaseResponse.success(feedService.getRecommendedUsers(workId, limit));
    }
}
