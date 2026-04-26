package com.filmroad.api.domain.comment;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.domain.comment.dto.CommentDto;
import com.filmroad.api.domain.comment.dto.CommentListResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

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

    /**
     * 댓글 작성 — multipart/form-data.
     * <ul>
     *   <li>{@code content}: 텍스트 본문 (form field, 필수, 최대 500자)</li>
     *   <li>{@code image}: 인증샷 이미지 (file part, 선택, 1장)</li>
     *   <li>{@code parentId}: 답글이면 부모 댓글 id (form field, 선택). 답글의 답글은 거부된다.</li>
     * </ul>
     */
    @PostMapping(value = "/api/photos/{photoId}/comments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public BaseResponse<CommentDto> create(
            @PathVariable Long photoId,
            @RequestParam("content") String content,
            @RequestParam(value = "parentId", required = false) Long parentId,
            @RequestPart(value = "image", required = false) MultipartFile image
    ) {
        return BaseResponse.success(commentService.createComment(photoId, content, image, parentId));
    }

    @DeleteMapping("/api/comments/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        commentService.deleteComment(id);
        return ResponseEntity.noContent().build();
    }
}
