package com.filmroad.api.domain.badge.dto;

import com.filmroad.api.domain.badge.Badge;
import com.filmroad.api.domain.badge.UserBadge;
import lombok.Builder;
import lombok.Getter;

import java.util.Date;

@Getter
@Builder
public class UserBadgeDto {
    private Long badgeId;
    private String code;
    private String name;
    private String description;
    private String iconKey;
    private String gradient;
    private boolean acquired;
    private String progressText;
    private Date acquiredAt;

    public static UserBadgeDto acquired(UserBadge ub, String progressText) {
        Badge b = ub.getBadge();
        return UserBadgeDto.builder()
                .badgeId(b.getId())
                .code(b.getCode())
                .name(b.getName())
                .description(b.getDescription())
                .iconKey(b.getIconKey())
                .gradient(b.getGradient())
                .acquired(true)
                .progressText(progressText)
                .acquiredAt(ub.getAcquiredAt())
                .build();
    }

    public static UserBadgeDto locked(Badge b, String progressText) {
        return UserBadgeDto.builder()
                .badgeId(b.getId())
                .code(b.getCode())
                .name(b.getName())
                .description(b.getDescription())
                .iconKey(b.getIconKey())
                .gradient(b.getGradient())
                .acquired(false)
                .progressText(progressText)
                .acquiredAt(null)
                .build();
    }
}
