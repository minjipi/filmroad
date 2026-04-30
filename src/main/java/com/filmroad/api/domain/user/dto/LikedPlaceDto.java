package com.filmroad.api.domain.user.dto;

import com.filmroad.api.domain.like.PlaceLike;
import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceCoverImage;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * `GET /api/users/me/liked-places` 응답의 단건. ProfilePage 메뉴에서 진입하는
 * "좋아요한 장소" 그리드의 카드에 필요한 필드만 노출.
 *
 * <p>커서는 PlaceLike row 의 id (좋아요를 누른 시점의 역순). 페이지 카드 클릭 시
 * `/place/:id` 로 라우팅되므로 placeId 가 핵심.</p>
 */
@Getter
@Builder
public class LikedPlaceDto {
    /** 카드 클릭 시 /place/:id 라우팅 키. */
    private Long id;
    private String name;
    private String regionLabel;
    private List<String> coverImageUrls;
    private Long contentId;
    private String contentTitle;
    private int likeCount;
    /** 페이지네이션 cursor 키 — PlaceLike row id (서버에서만 의미). */
    private Long likeId;

    public static LikedPlaceDto from(PlaceLike pl) {
        Place p = pl.getPlace();
        return LikedPlaceDto.builder()
                .id(p.getId())
                .name(p.getName())
                .regionLabel(p.getRegionLabel())
                .coverImageUrls(p.getCoverImages().stream().map(PlaceCoverImage::getImageUrl).toList())
                .contentId(p.getContent() == null ? null : p.getContent().getId())
                .contentTitle(p.getContent() == null ? null : p.getContent().getTitle())
                .likeCount(p.getLikeCount())
                .likeId(pl.getId())
                .build();
    }
}
