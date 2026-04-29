package com.filmroad.api.domain.home;

public enum HomeScope {
    NEAR,
    TRENDING,
    // 프론트의 인기 작품 view 토글. 백엔드는 TRENDING 과 동일하게 처리하지만,
    // 사용자가 ?scope=POPULAR_WORKS URL 로 직접 진입할 때 enum 바인딩이 실패하지
    // 않도록 값을 받아준다 (HomeService 의 else 분기가 자동으로 trending 정렬을 적용).
    POPULAR_WORKS
}
