package com.filmroad.api.domain.comment;

import com.filmroad.api.common.auth.CurrentUser;
import com.filmroad.api.common.exception.BaseException;
import com.filmroad.api.common.model.BaseResponseStatus;
import com.filmroad.api.domain.comment.dto.CommentDto;
import com.filmroad.api.domain.comment.dto.CommentListResponse;
import com.filmroad.api.domain.place.PlacePhoto;
import com.filmroad.api.domain.place.PlacePhotoRepository;
import com.filmroad.api.domain.user.User;
import com.filmroad.api.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CommentService {

    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 50;

    private final PostCommentRepository postCommentRepository;
    private final PlacePhotoRepository placePhotoRepository;
    private final UserRepository userRepository;
    private final CurrentUser currentUser;

    @Transactional
    public CommentDto createComment(Long photoId, String content) {
        String trimmed = content == null ? "" : content.trim();
        if (trimmed.isEmpty()) {
            throw BaseException.of(BaseResponseStatus.REQUEST_ERROR);
        }

        PlacePhoto photo = placePhotoRepository.findById(photoId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.PLACE_NOT_FOUND));

        Long userId = currentUser.currentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.RESPONSE_NULL_ERROR));

        PostComment saved = postCommentRepository.save(PostComment.builder()
                .user(user)
                .placePhoto(photo)
                .content(trimmed)
                .build());

        photo.applyCommentDelta(1);
        return CommentDto.from(saved);
    }

    @Transactional
    public void deleteComment(Long commentId) {
        Long userId = currentUser.currentUserId();
        PostComment comment = postCommentRepository.findById(commentId)
                .orElseThrow(() -> BaseException.of(BaseResponseStatus.COMMENT_NOT_FOUND));
        if (!postCommentRepository.existsByIdAndUserId(commentId, userId)) {
            throw BaseException.of(BaseResponseStatus.UNAUTHORIZED_COMMENT);
        }
        PlacePhoto photo = comment.getPlacePhoto();
        postCommentRepository.delete(comment);
        photo.applyCommentDelta(-1);
    }

    @Transactional(readOnly = true)
    public CommentListResponse listComments(Long photoId, Long cursor, int limit) {
        int safeLimit = limit <= 0 ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);
        long safeCursor = cursor == null ? 0L : cursor;
        int fetchSize = safeLimit + 1;

        List<PostComment> fetched = postCommentRepository.findPageByPhoto(photoId, safeCursor, PageRequest.of(0, fetchSize));
        boolean hasMore = fetched.size() > safeLimit;
        List<PostComment> page = hasMore ? fetched.subList(0, safeLimit) : fetched;
        Long nextCursor = hasMore && !page.isEmpty() ? page.get(page.size() - 1).getId() : null;

        return CommentListResponse.builder()
                .comments(page.stream().map(CommentDto::from).toList())
                .hasMore(hasMore)
                .nextCursor(nextCursor)
                .build();
    }
}
