package com.filmroad.api.common.exception;

import com.filmroad.api.common.model.BaseResponse;
import com.filmroad.api.common.model.BaseResponseStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;

import static com.filmroad.api.common.model.BaseResponseStatus.REQUEST_ERROR;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<BaseResponse<Object>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        String errorMessage = ex.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(FieldError::getDefaultMessage)
                .orElse("입력값이 잘못되었습니다.");

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(BaseResponse.error(REQUEST_ERROR, errorMessage));
    }

    @ExceptionHandler(BaseException.class)
    public ResponseEntity<BaseResponse<Object>> handleBaseException(BaseException ex) {
        BaseResponseStatus status = ex.getStatus();

        // 호출부가 `new BaseException(status, customMessage)` 로 명시적 메시지를
        // 던졌을 땐 그 메시지를 클라이언트에 그대로 전달. 기본 enum 메시지와 다를
        // 때만 override — 기본값과 동일하면 표준 응답을 사용해 분기를 단순하게.
        // 이전엔 BaseResponse.error(status) 만 호출해서 호출부의 사용자 정의
        // 메시지가 전달 경로 중간에서 통째로 사라지는 잠재 버그가 있었음.
        String customMessage = ex.getMessage();
        boolean hasCustom = customMessage != null && !customMessage.equals(status.getMessage());

        return ResponseEntity
                .status(mapToHttpStatus(status.getCode()))
                .body(hasCustom
                        ? BaseResponse.error(status, customMessage)
                        : BaseResponse.error(status));
    }

    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<BaseResponse<Object>> handleDisabledException(DisabledException ex) {
        return handleBaseException(BaseException.of(BaseResponseStatus.INVALID_USER_DISABLED));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<BaseResponse<Object>> handleBadCredentialsException(BadCredentialsException ex) {
        return handleBaseException(BaseException.of(BaseResponseStatus.INVALID_USER_INFO));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<BaseResponse<Object>> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        // multipart max-file-size 초과. 현재 application.yml 10MB. HTTP 413 + 사용자 친화 한국어 메시지.
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(BaseResponse.error(BaseResponseStatus.UPLOAD_FAILED,
                        "파일 크기가 너무 커요 (최대 10MB)."));
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<BaseResponse<Object>> handleMultipart(MultipartException ex) {
        // 잘못된 multipart 바디, 파트 누락 등.
        log.warn("[UPLOAD] multipart 처리 실패: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(BaseResponse.error(BaseResponseStatus.UPLOAD_FAILED,
                        "파일 업로드 요청이 잘못되었어요. 다시 시도해주세요."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<BaseResponse<Object>> handleException(Exception ex) {
        log.error("[SERVER] 예상치 못한 오류 발생: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(BaseResponse.error(REQUEST_ERROR));
    }

    private int mapToHttpStatus(int statusCode) {
        // 리소스 조회 실패 계열은 HTTP 404로 매핑해 RESTful 시맨틱 유지.
        if (statusCode == BaseResponseStatus.PLACE_NOT_FOUND.getCode()
                || statusCode == BaseResponseStatus.CONTENT_NOT_FOUND.getCode()
                || statusCode == BaseResponseStatus.USER_NOT_FOUND.getCode()
                || statusCode == BaseResponseStatus.COMMENT_NOT_FOUND.getCode()
                || statusCode == BaseResponseStatus.COLLECTION_NOT_FOUND.getCode()
                || statusCode == BaseResponseStatus.PHOTO_NOT_FOUND.getCode()
                || statusCode == BaseResponseStatus.ROUTE_NOT_FOUND.getCode()) {
            return 404;
        }
        if (statusCode == BaseResponseStatus.UNAUTHORIZED_COMMENT.getCode()
                || statusCode == BaseResponseStatus.ROUTE_FORBIDDEN.getCode()) {
            return 403;
        }
        // 자격증명 실패 계열은 401, 리소스 충돌(중복 이메일 등)은 409.
        if (statusCode == BaseResponseStatus.INVALID_USER_INFO.getCode()
                || statusCode == BaseResponseStatus.INVALID_USER_PASSWORD.getCode()) {
            return 401;
        }
        if (statusCode == BaseResponseStatus.DUPLICATE_USER_EMAIL.getCode()) {
            return 409;
        }
        // 40000번대 응답 오류 -> 400, 30000번대 요청 오류 -> 400, 기타 -> 500
        if (statusCode >= 40000 && statusCode < 50000) {
            return 400;
        } else if (statusCode >= 20000 && statusCode < 40000) {
            return 400;
        } else if (statusCode >= 50000 && statusCode < 60000) {
            return 500;
        } else {
            return 500;
        }
    }

}
