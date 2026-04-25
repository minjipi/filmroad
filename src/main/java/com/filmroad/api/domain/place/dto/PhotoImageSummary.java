package com.filmroad.api.domain.place.dto;

import com.filmroad.api.domain.place.PlacePhotoImage;
import lombok.Builder;
import lombok.Getter;

/**
 * 인증샷 post 의 첨부 이미지 1장. ShotDetailPage carousel 이 인덱스 기준으로 슬라이드를 그릴 때
 * 각 frame 의 최소 정보 (id / imageUrl / imageOrderIndex).
 *
 * <p>`id` 는 PlacePhotoImage.id 로, post id (PlacePhoto.id) 와는 별개. 프론트는 carousel 내부
 * key 로만 사용하면 된다 — like / comment 같은 post 단위 액션은 부모 PlacePhoto.id 기준.
 */
@Getter
@Builder
public class PhotoImageSummary {
    private Long id;
    private String imageUrl;
    private int imageOrderIndex;

    public static PhotoImageSummary from(PlacePhotoImage image) {
        return PhotoImageSummary.builder()
                .id(image.getId())
                .imageUrl(image.getImageUrl())
                .imageOrderIndex(image.getImageOrderIndex())
                .build();
    }
}
