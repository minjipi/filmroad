package com.filmroad.api.domain.feed;

public enum FeedTab {
    RECENT,      // 기본. 최신 id DESC 정렬.
    POPULAR,     // like_count DESC + id DESC.
    FOLLOWING,
    NEARBY,
    BY_WORK
}
