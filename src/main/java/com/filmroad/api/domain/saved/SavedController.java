package com.filmroad.api.domain.saved;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.saved.dto.AddPlaceToCollectionRequest;
import com.filmroad.api.domain.saved.dto.CollectionDetailResponse;
import com.filmroad.api.domain.saved.dto.CollectionSummaryDto;
import com.filmroad.api.domain.saved.dto.CreateCollectionRequest;
import com.filmroad.api.domain.saved.dto.RenameCollectionRequest;
import com.filmroad.api.domain.saved.dto.ReorderPlacesRequest;
import com.filmroad.api.domain.saved.dto.SavedResponse;
import com.filmroad.api.domain.saved.dto.ToggleSaveRequest;
import com.filmroad.api.domain.saved.dto.ToggleSaveResponse;
import com.filmroad.api.domain.saved.dto.UpdatePlaceNoteRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/saved")
@RequiredArgsConstructor
@Validated
public class SavedController {

    private final SavedService savedService;

    @GetMapping
    public BaseResponse<SavedResponse> getSaved(
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng
    ) {
        return BaseResponse.success(savedService.getSaved(lat, lng));
    }

    @GetMapping("/collections/{id}")
    public BaseResponse<CollectionDetailResponse> getCollection(
            @PathVariable("id") Long id,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng
    ) {
        return BaseResponse.success(savedService.getCollectionDetail(id, lat, lng));
    }

    @PatchMapping("/collections/{id}")
    public BaseResponse<CollectionSummaryDto> renameCollection(
            @PathVariable("id") Long id,
            @RequestBody @Valid RenameCollectionRequest req
    ) {
        return BaseResponse.success(savedService.renameCollection(id, req.getName()));
    }

    @DeleteMapping("/collections/{id}")
    public BaseResponse<Void> deleteCollection(@PathVariable("id") Long id) {
        savedService.deleteCollection(id);
        return BaseResponse.success(null);
    }

    @PostMapping("/toggle")
    public BaseResponse<ToggleSaveResponse> toggle(@RequestBody @Valid ToggleSaveRequest req) {
        return BaseResponse.success(savedService.toggleSave(req.getPlaceId(), req.getCollectionId()));
    }

    /**
     * 컬렉션 생성 (#26 기본 흐름 + #6 트립 루트 확장).
     * description, placeIds 옵셔널 — placeIds 가 있으면 입력 순서대로 SavedPlace 를 같이 만든다.
     * 응답은 모든 mutate endpoint 와 동일하게 `CollectionDetailResponse` 통째 — 프론트가 추가 GET 안 함.
     */
    @PostMapping("/collections")
    public ResponseEntity<BaseResponse<CollectionDetailResponse>> createCollection(
            @RequestBody @Valid CreateCollectionRequest req) {
        CollectionDetailResponse created = savedService.createCollection(
                req.getName(), req.getDescription(), req.getPlaceIds());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success(created));
    }

    /** 트립 루트(#6): 컬렉션 끝(orderIndex max+1)에 장소 1건 추가. userNote 옵셔널. */
    @PostMapping("/collections/{id}/places")
    public BaseResponse<CollectionDetailResponse> addPlaceToCollection(
            @PathVariable("id") Long id,
            @RequestBody @Valid AddPlaceToCollectionRequest req
    ) {
        return BaseResponse.success(
                savedService.addPlaceToCollection(id, req.getPlaceId(), req.getUserNote()));
    }

    /** 트립 루트(#6): 컬렉션에서 장소 1건 제거 (SavedPlace 행 자체 삭제 = 저장 해제). */
    @DeleteMapping("/collections/{id}/places/{placeId}")
    public BaseResponse<CollectionDetailResponse> removePlaceFromCollection(
            @PathVariable("id") Long id,
            @PathVariable("placeId") Long placeId
    ) {
        return BaseResponse.success(savedService.removePlaceFromCollection(id, placeId));
    }

    /** 트립 루트(#6): 컬렉션 내 장소들의 orderIndex 를 입력 순서대로 0..N-1 일괄 갱신 (set 동등 검증). */
    @PatchMapping("/collections/{id}/order")
    public BaseResponse<CollectionDetailResponse> reorderCollection(
            @PathVariable("id") Long id,
            @RequestBody @Valid ReorderPlacesRequest req
    ) {
        return BaseResponse.success(savedService.reorderCollection(id, req.getPlaceIds()));
    }

    /** 트립 루트(#6): 장소별 메모 갱신. null/빈 문자열 모두 허용 (clear). */
    @PatchMapping("/collections/{id}/places/{placeId}/note")
    public BaseResponse<CollectionDetailResponse> updatePlaceNote(
            @PathVariable("id") Long id,
            @PathVariable("placeId") Long placeId,
            @RequestBody @Valid UpdatePlaceNoteRequest req
    ) {
        return BaseResponse.success(savedService.updatePlaceNote(id, placeId, req.getUserNote()));
    }
}
