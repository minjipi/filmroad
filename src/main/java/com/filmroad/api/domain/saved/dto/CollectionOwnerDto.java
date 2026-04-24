package com.filmroad.api.domain.saved.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * 컬렉션 상세(#30)의 owner strip 정보. `isMe` 는 호출 컨텍스트의 유저와 소유자가 같은지 여부.
 * 현 단계는 private 컬렉션만 허용이라 항상 true 이지만, 향후 public 컬렉션 확장을 대비해 노출.
 */
@Getter
@Builder
public class CollectionOwnerDto {
    private Long id;
    private String nickname;
    private String avatarUrl;
    // Boolean (wrapper) + `getIsMe()` getter 로 Jackson 이 `isMe` 키를 그대로 유지.
    // (primitive boolean 이면 `isMe()` 게터가 "is" 접두를 떼고 `me` 로 직렬화됨.)
    private Boolean isMe;
}
