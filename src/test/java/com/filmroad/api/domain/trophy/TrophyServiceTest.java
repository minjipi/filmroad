package com.filmroad.api.domain.trophy;

import com.filmroad.api.domain.content.Content;
import com.filmroad.api.domain.user.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link TrophyService#maybeAward}. percent → tier 매핑 + 격상/유지 로직.
 * Repository 는 mockito 로 격리 (DB 의존 없음). enum tier 의 ordinal 비교가 의도대로
 * 작동하는지가 핵심 — 강등 X, 같은 tier 재발급 X.
 */
@ExtendWith(MockitoExtension.class)
class TrophyServiceTest {

    @Mock private ContentTrophyRepository trophyRepository;
    @Mock private com.filmroad.api.domain.stamp.StampRepository stampRepository;
    @Mock private com.filmroad.api.domain.place.PlaceRepository placeRepository;
    @InjectMocks private TrophyService trophyService;

    private User user(Long id) {
        return User.builder().id(id).nickname("tester").handle("@t").build();
    }

    private Content content(Long id) {
        return Content.builder().id(id).title("도깨비").build();
    }

    @Test
    @DisplayName("percent < 25 → 트로피 row 생성하지 않고 null 반환 (시각 노이즈 회피)")
    void maybeAward_below25_noTrophy() {
        User u = user(1L);
        Content c = content(10L);

        ContentTrophyTier result = trophyService.maybeAward(u, c, 24);

        assertThat(result).isNull();
        verify(trophyRepository, never()).save(any());
    }

    @Test
    @DisplayName("기존 트로피 없을 때 percent=25 → QUARTER 신규 생성")
    void maybeAward_first25_createsQuarter() {
        User u = user(1L);
        Content c = content(10L);
        when(trophyRepository.findByUserIdAndContentId(1L, 10L)).thenReturn(Optional.empty());

        ContentTrophyTier result = trophyService.maybeAward(u, c, 25);

        assertThat(result).isEqualTo(ContentTrophyTier.QUARTER);
        verify(trophyRepository).save(any(ContentTrophy.class));
    }

    @Test
    @DisplayName("기존 QUARTER 보유 → percent=50 진입 시 HALF 로 격상 (같은 row 의 promote)")
    void maybeAward_quarterToHalf_promotes() {
        User u = user(1L);
        Content c = content(10L);
        ContentTrophy existing = ContentTrophy.builder()
                .user(u).content(c).tier(ContentTrophyTier.QUARTER).build();
        when(trophyRepository.findByUserIdAndContentId(1L, 10L)).thenReturn(Optional.of(existing));

        ContentTrophyTier result = trophyService.maybeAward(u, c, 50);

        assertThat(result).isEqualTo(ContentTrophyTier.HALF);
        assertThat(existing.getTier()).isEqualTo(ContentTrophyTier.HALF);
        // promote 는 dirty checking — save 호출되지 않아도 OK.
        verify(trophyRepository, never()).save(any());
    }

    @Test
    @DisplayName("같은 tier 재진입 → null 반환 (중복 알림 차단)")
    void maybeAward_sameTier_returnsNull() {
        User u = user(1L);
        Content c = content(10L);
        ContentTrophy existing = ContentTrophy.builder()
                .user(u).content(c).tier(ContentTrophyTier.HALF).build();
        when(trophyRepository.findByUserIdAndContentId(1L, 10L)).thenReturn(Optional.of(existing));

        ContentTrophyTier result = trophyService.maybeAward(u, c, 60);

        assertThat(result).isNull();
        assertThat(existing.getTier()).isEqualTo(ContentTrophyTier.HALF);
    }

    @Test
    @DisplayName("기존 MASTER → percent 가 떨어져도 강등하지 않음 (영구 트로피)")
    void maybeAward_neverDemotes() {
        User u = user(1L);
        Content c = content(10L);
        ContentTrophy existing = ContentTrophy.builder()
                .user(u).content(c).tier(ContentTrophyTier.MASTER).build();
        when(trophyRepository.findByUserIdAndContentId(1L, 10L)).thenReturn(Optional.of(existing));

        ContentTrophyTier result = trophyService.maybeAward(u, c, 30);

        assertThat(result).isNull();
        assertThat(existing.getTier()).isEqualTo(ContentTrophyTier.MASTER);
    }

    @Test
    @DisplayName("percent=100 첫 진입 → MASTER 신규 생성")
    void maybeAward_first100_createsMaster() {
        User u = user(1L);
        Content c = content(10L);
        when(trophyRepository.findByUserIdAndContentId(1L, 10L)).thenReturn(Optional.empty());

        ContentTrophyTier result = trophyService.maybeAward(u, c, 100);

        assertThat(result).isEqualTo(ContentTrophyTier.MASTER);
        verify(trophyRepository).save(any(ContentTrophy.class));
    }

    @Test
    @DisplayName("ContentTrophyTier.fromPercent 컷오프 — 24/25/49/50/74/75/99/100 경계")
    void fromPercent_boundaries() {
        assertThat(ContentTrophyTier.fromPercent(24)).isNull();
        assertThat(ContentTrophyTier.fromPercent(25)).isEqualTo(ContentTrophyTier.QUARTER);
        assertThat(ContentTrophyTier.fromPercent(49)).isEqualTo(ContentTrophyTier.QUARTER);
        assertThat(ContentTrophyTier.fromPercent(50)).isEqualTo(ContentTrophyTier.HALF);
        assertThat(ContentTrophyTier.fromPercent(74)).isEqualTo(ContentTrophyTier.HALF);
        assertThat(ContentTrophyTier.fromPercent(75)).isEqualTo(ContentTrophyTier.THREE_Q);
        assertThat(ContentTrophyTier.fromPercent(99)).isEqualTo(ContentTrophyTier.THREE_Q);
        assertThat(ContentTrophyTier.fromPercent(100)).isEqualTo(ContentTrophyTier.MASTER);
    }
}
