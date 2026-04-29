package com.filmroad.api.domain.place.dto;

/**
 * 인증샷 채점 결과 — `ShotScoringService.score(...)` 의 반환 타입.
 * Service 내부 데이터 운반용 record. Controller / 응답 DTO 에 직접 노출하지 않고
 * `PlacePhoto.applyScores(similarity, gps, total)` 로 엔티티에 풀어서 적용한 뒤
 * `PhotoUploadResponse` / `PhotoDetailResponse` 가 평탄 필드(totalScore / similarityScore / gpsScore)
 * 로 노출.
 *
 * @param similarityScore 가이드 사진(Place.sceneImages 의 대표 = primary) 과 업로드 사진의 pHash 유사도 점수 0~100.
 * @param gpsScore        Place 등록 좌표와 촬영 좌표(capturedLat/Lng) 의 Haversine 거리 점수 0~100.
 * @param totalScore      가중합 round(similarity * 0.6 + gps * 0.4), 0~100.
 */
public record ShotScoreDto(int similarityScore, int gpsScore, int totalScore) {
    public static ShotScoreDto zero() {
        return new ShotScoreDto(0, 0, 0);
    }
}
