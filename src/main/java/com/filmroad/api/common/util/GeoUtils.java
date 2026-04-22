package com.filmroad.api.common.util;

/**
 * 위/경도 거리 계산 공용 util. MapService / PlaceDetailService / SavedService가 공통 사용.
 * MariaDB는 내장 haversine이 없어 애플리케이션 레이어에서 계산.
 */
public final class GeoUtils {

    private static final double EARTH_RADIUS_KM = 6371.0;

    private GeoUtils() {
    }

    public static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c;
    }

    public static Double distanceKmOrNull(Double lat1, Double lon1, double lat2, double lon2) {
        if (lat1 == null || lon1 == null) return null;
        return haversineKm(lat1, lon1, lat2, lon2);
    }
}
