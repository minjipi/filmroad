package com.filmroad.api.domain.trophy;

import com.filmroad.api.domain.content.Content;
import com.filmroad.api.domain.place.PlaceRepository;
import com.filmroad.api.domain.stamp.StampRepository;
import com.filmroad.api.domain.trophy.dto.ContentTrophyDto;
import com.filmroad.api.domain.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * 작품 컴플리트 트로피 부여 / 조회 도메인 서비스.
 *
 * <p>업로드 트랜잭션의 {@link com.filmroad.api.domain.place.PhotoUploadService} 가
 * stamp 저장 직후 {@link #maybeAward} 를 호출. percent 가 새 마일스톤(25/50/75/100)
 * 을 넘으면 trophy row 를 생성/격상하고 변동된 tier 를 반환한다. 변동 없으면 null.</p>
 *
 * <p>한번 획득한 트로피는 stamp 가 사라져도 유지(영구). 즉 percent 가 떨어진
 * 경우엔 tier 를 강등하지 않는다.</p>
 */
@Service
@RequiredArgsConstructor
public class TrophyService {

    private final ContentTrophyRepository contentTrophyRepository;
    private final StampRepository stampRepository;
    private final PlaceRepository placeRepository;

    /**
     * percent 가 새 마일스톤에 도달했으면 trophy 생성/격상 후 새 tier 반환.
     * 변동 없으면 null. percent 는 0~100 정수(반올림된) 가정.
     */
    @Transactional
    public ContentTrophyTier maybeAward(User user, Content content, int percent) {
        ContentTrophyTier reachable = ContentTrophyTier.fromPercent(percent);
        if (reachable == null) {
            // 25% 미만 — 트로피 없음.
            return null;
        }

        Optional<ContentTrophy> existing = contentTrophyRepository
                .findByUserIdAndContentId(user.getId(), content.getId());

        if (existing.isPresent()) {
            ContentTrophy trophy = existing.get();
            // 강등 X — 항상 더 높은 단계로만 이동. ordinal 이 클수록 상위.
            if (reachable.ordinal() > trophy.getTier().ordinal()) {
                trophy.promote(reachable);
                return reachable;
            }
            return null;
        }

        contentTrophyRepository.save(ContentTrophy.builder()
                .user(user)
                .content(content)
                .tier(reachable)
                .build());
        return reachable;
    }

    /**
     * 한 사용자의 트로피 카드 리스트. tier 가 높을수록 위, 동일 tier 내 awardedAt DESC.
     * 진행도(collected/total) 는 stamp 와 place 카운트로 즉석 계산해서 카드에 박는다.
     */
    @Transactional(readOnly = true)
    public List<ContentTrophyDto> listForUser(Long userId) {
        List<ContentTrophy> trophies = contentTrophyRepository.findByUserIdWithContent(userId);
        if (trophies.isEmpty()) return List.of();
        return trophies.stream()
                .sorted((a, b) -> {
                    int t = Integer.compare(b.getTier().ordinal(), a.getTier().ordinal());
                    if (t != 0) return t;
                    return b.getAwardedAt().compareTo(a.getAwardedAt());
                })
                .map(t -> {
                    Long contentId = t.getContent().getId();
                    long collected = stampRepository.countByUserIdAndContentId(userId, contentId);
                    long total = placeRepository.countByContentId(contentId);
                    return ContentTrophyDto.of(t, collected, total);
                })
                .toList();
    }
}
