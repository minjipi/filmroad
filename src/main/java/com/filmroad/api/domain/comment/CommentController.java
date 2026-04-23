package com.filmroad.api.domain.comment;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.comment.dto.CommentCreateRequest;
import com.filmroad.api.domain.comment.dto.CommentDto;
import com.filmroad.api.domain.comment.dto.CommentListResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping
@RequiredArgsConstructor
@Validated
public class CommentController {

    private final CommentService commentService;

    @GetMapping("/api/photos/{photoId}/comments")
    public BaseResponse<CommentListResponse> list(
            @PathVariable Long photoId,
            @RequestParam(required = false) Long cursor,
            @RequestParam(required = false, defaultValue = "20") int limit
    ) {
        return BaseResponse.success(commentService.listComments(photoId, cursor, limit));
    }

    @PostMapping("/api/photos/{photoId}/comments")
    public BaseResponse<CommentDto> create(
            @PathVariable Long photoId,
            @RequestBody @Valid CommentCreateRequest req
    ) {
        return BaseResponse.success(commentService.createComment(photoId, req.getContent()));
    }

    @DeleteMapping("/api/comments/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        commentService.deleteComment(id);
        return ResponseEntity.noContent().build();
    }
}
