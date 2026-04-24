package com.filmroad.api.domain.saved;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.saved.dto.CollectionDetailResponse;
import com.filmroad.api.domain.saved.dto.CollectionSummaryDto;
import com.filmroad.api.domain.saved.dto.CreateCollectionRequest;
import com.filmroad.api.domain.saved.dto.SavedResponse;
import com.filmroad.api.domain.saved.dto.ToggleSaveRequest;
import com.filmroad.api.domain.saved.dto.ToggleSaveResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
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
            @org.springframework.web.bind.annotation.PathVariable("id") Long id,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng
    ) {
        return BaseResponse.success(savedService.getCollectionDetail(id, lat, lng));
    }

    @PostMapping("/toggle")
    public BaseResponse<ToggleSaveResponse> toggle(@RequestBody @Valid ToggleSaveRequest req) {
        return BaseResponse.success(savedService.toggleSave(req.getPlaceId(), req.getCollectionId()));
    }

    @PostMapping("/collections")
    public ResponseEntity<BaseResponse<CollectionSummaryDto>> createCollection(
            @RequestBody @Valid CreateCollectionRequest req) {
        CollectionSummaryDto created = savedService.createCollection(req.getName());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success(created));
    }
}
