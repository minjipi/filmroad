package com.filmroad.api.domain.trophy;

/**
 * 작품(Content) 단위 컴플리트 트로피 단계. percent (collected / total) 가 각 컷오프
 * 이상일 때 진입한다.
 *
 * <pre>
 *   25%  → QUARTER
 *   50%  → HALF
 *   75%  → THREE_Q
 *   100% → MASTER
 * </pre>
 *
 * 25% 미만은 trophy row 자체를 만들지 않는다(시각 노이즈 회피). tier 순서는
 * ordinal 비교가 가능하도록 낮은 → 높은 순으로 선언.
 */
public enum ContentTrophyTier {
    QUARTER,
    HALF,
    THREE_Q,
    MASTER;

    /**
     * percent (0~100) 으로부터 도달 가능한 최고 tier. 25% 미만이면 null.
     */
    public static ContentTrophyTier fromPercent(int percent) {
        if (percent >= 100) return MASTER;
        if (percent >= 75) return THREE_Q;
        if (percent >= 50) return HALF;
        if (percent >= 25) return QUARTER;
        return null;
    }
}
