package com.filmroad.api.domain.place;

import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.follow.UserFollowRepository;
import com.filmroad.api.domain.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 인증샷의 visibility 규칙을 한 곳에 모은 가드. PhotoDetailService 의 canView
 * 와 동일 규칙(공유):
 *
 * <pre>
 *   PUBLIC          : 모두 통과
 *   FOLLOWERS       : 작성자 본인 + 작성자를 팔로우 중인 viewer
 *   PRIVATE         : 작성자 본인만
 *   author=null     : 시드 사진 — PUBLIC 으로 간주(운영 업로드는 항상 user 채움)
 * </pre>
 *
 * <p>권한 없으면 PHOTO_NOT_FOUND(404) 로 통일 — 보안상 "사진은 있으나 권한
 * 없음" 정보를 흘리지 않기 위함 (enumeration 차단). 같은 이유로 ShotDetail
 * 직접 조회와 like/comment 같은 photo-scoped action 진입에 같은 메시지를
 * 사용한다.
 *
 * <p>read-only 컴포넌트라 stateless. 호출부는 photo + viewerId 만 넘기고
 * 결과는 throw 또는 정상 반환.
 */
@Component
@RequiredArgsConstructor
public class PhotoVisibilityGuard {

    private final UserFollowRepository userFollowRepository;

    /** viewer 가 photo 를 볼 권한이 있는지 검사. 권한 없음 → PHOTO_NOT_FOUND. */
    public void assertViewable(PlacePhoto photo, Long viewerId) {
        if (canView(photo, viewerId)) return;
        throw BaseException.of(BaseResponseStatus.PHOTO_NOT_FOUND);
    }

    /** 권한 boolean 반환 — 호출부가 throw 대신 분기하고 싶을 때 사용. */
    public boolean canView(PlacePhoto photo, Long viewerId) {
        PhotoVisibility v = photo.getVisibility();
        if (v == null || v == PhotoVisibility.PUBLIC) return true;
        User owner = photo.getUser();
        if (owner == null) {
            // user 가 없는 시드 사진은 PRIVATE/FOLLOWERS 판단 기준이 모호하므로
            // PUBLIC 로 간주. 운영 업로드 경로에서는 항상 user 가 채워짐.
            return true;
        }
        if (viewerId != null && viewerId.equals(owner.getId())) return true;
        if (v == PhotoVisibility.FOLLOWERS && viewerId != null) {
            return userFollowRepository.existsByFollowerIdAndFolloweeId(viewerId, owner.getId());
        }
        return false;
    }
}
