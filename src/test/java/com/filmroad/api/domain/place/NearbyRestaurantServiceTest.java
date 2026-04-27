package com.filmroad.api.domain.place;

import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.domain.place.dto.NearbyRestaurantsResponse;
import com.filmroad.api.integration.koreatourism.KoreaTourismClient;
import com.filmroad.api.integration.koreatourism.KoreaTourismItem;
import com.filmroad.api.integration.koreatourism.RegionCode;
import com.filmroad.api.integration.koreatourism.RegionCodeLookup;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link NearbyRestaurantService} — Place 조회 + RegionCode lookup +
 * KoreaTourismClient 호출 시퀀스. Pure Mockito (no Spring context).
 */
@ExtendWith(MockitoExtension.class)
class NearbyRestaurantServiceTest {

    @Mock
    private PlaceRepository placeRepository;

    @Mock
    private KoreaTourismClient koreaTourismClient;

    @Mock
    private RegionCodeLookup regionCodeLookup;

    @InjectMocks
    private NearbyRestaurantService service;

    private static Place placeAt(double lat, double lng, String regionLabel, String address) {
        return Place.builder()
                .name("test place")
                .regionLabel(regionLabel)
                .address(address)
                .latitude(lat)
                .longitude(lng)
                .build();
    }

    @Test
    @DisplayName("placeId 부재 → BaseException(PLACE_NOT_FOUND), 외부 호출 없음")
    void unknownPlaceId_throwsAndDoesNotCallExternal() {
        when(placeRepository.findById(99999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getNearbyRestaurants(99999L))
                .isInstanceOf(BaseException.class);
    }

    @Test
    @DisplayName("regionCode 매핑 hit → client 에 RegionCode 인자 그대로 전달")
    void regionCodeMatched_passesCodeToClient() {
        Place place = placeAt(37.89, 128.83, "강원특별자치도 강릉시", "강원 강릉시 주문진읍");
        when(placeRepository.findById(10L)).thenReturn(Optional.of(place));
        RegionCode code = new RegionCode("51", "770");
        when(regionCodeLookup.lookup(place.getRegionLabel(), place.getAddress()))
                .thenReturn(Optional.of(code));
        when(koreaTourismClient.findNearbyRestaurants(anyDouble(), anyDouble(), any()))
                .thenReturn(List.of());

        service.getNearbyRestaurants(10L);

        ArgumentCaptor<RegionCode> captor = ArgumentCaptor.forClass(RegionCode.class);
        verify(koreaTourismClient).findNearbyRestaurants(eq(37.89), eq(128.83), captor.capture());
        assertThat(captor.getValue()).isEqualTo(code);
    }

    @Test
    @DisplayName("regionCode 매핑 미스 → client 에 null 전달 (좌표만으로 호출)")
    void regionCodeMissing_passesNullToClient() {
        Place place = placeAt(37.89, 128.83, "알 수 없는 지역", null);
        when(placeRepository.findById(10L)).thenReturn(Optional.of(place));
        when(regionCodeLookup.lookup(place.getRegionLabel(), place.getAddress()))
                .thenReturn(Optional.empty());
        when(koreaTourismClient.findNearbyRestaurants(anyDouble(), anyDouble(), any()))
                .thenReturn(List.of());

        service.getNearbyRestaurants(10L);

        ArgumentCaptor<RegionCode> captor = ArgumentCaptor.forClass(RegionCode.class);
        verify(koreaTourismClient).findNearbyRestaurants(eq(37.89), eq(128.83), captor.capture());
        assertThat(captor.getValue()).isNull();
    }

    @Test
    @DisplayName("외부 API 빈 결과 → response.items=[], 예외 X")
    void externalReturnsEmpty_returnsEmptyResponse() {
        Place place = placeAt(37.89, 128.83, "강원 강릉시", null);
        when(placeRepository.findById(10L)).thenReturn(Optional.of(place));
        when(regionCodeLookup.lookup(any(), any())).thenReturn(Optional.empty());
        when(koreaTourismClient.findNearbyRestaurants(anyDouble(), anyDouble(), any()))
                .thenReturn(List.of());

        NearbyRestaurantsResponse response = service.getNearbyRestaurants(10L);

        assertThat(response.getItems()).isEmpty();
    }

    @Test
    @DisplayName("외부 API 정상 → KoreaTourismItem 을 NearbyRestaurantItem 으로 매핑 (mapX→lng, mapY→lat)")
    void externalReturnsItems_mapsToResponseDto() {
        Place place = placeAt(37.89, 128.83, "강원 강릉시", null);
        when(placeRepository.findById(10L)).thenReturn(Optional.of(place));
        when(regionCodeLookup.lookup(any(), any())).thenReturn(Optional.empty());

        KoreaTourismItem raw = new KoreaTourismItem(
                "C-1234",
                "주문진해전어",
                "강원 강릉시 주문진읍 ...",
                120,
                "033-661-1234",
                "https://image.example.com/abc.jpg",
                128.8350,   // mapX = longitude
                37.8927     // mapY = latitude
        );
        when(koreaTourismClient.findNearbyRestaurants(anyDouble(), anyDouble(), any()))
                .thenReturn(List.of(raw));

        NearbyRestaurantsResponse response = service.getNearbyRestaurants(10L);

        assertThat(response.getItems()).hasSize(1);
        var item = response.getItems().get(0);
        assertThat(item.getContentId()).isEqualTo("C-1234");
        assertThat(item.getTitle()).isEqualTo("주문진해전어");
        assertThat(item.getAddr1()).isEqualTo("강원 강릉시 주문진읍 ...");
        assertThat(item.getDistance()).isEqualTo(120);
        assertThat(item.getTel()).isEqualTo("033-661-1234");
        assertThat(item.getImageUrl()).isEqualTo("https://image.example.com/abc.jpg");
        // mapX → lng, mapY → lat 매핑 검증
        assertThat(item.getLng()).isEqualTo(128.8350);
        assertThat(item.getLat()).isEqualTo(37.8927);
    }
}
