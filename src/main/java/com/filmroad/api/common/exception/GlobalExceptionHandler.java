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

        return ResponseEntity
                .status(mapToHttpStatus(status.getCode()))
                .body(BaseResponse.error(status));
    }

    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<BaseResponse<Object>> handleDisabledException(DisabledException ex) {
        return handleBaseException(BaseException.of(BaseResponseStatus.INVALID_USER_DISABLED));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<BaseResponse<Object>> handleBadCredentialsException(BadCredentialsException ex) {
        return handleBaseException(BaseException.of(BaseResponseStatus.INVALID_USER_INFO));
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
                || statusCode == BaseResponseStatus.WORK_NOT_FOUND.getCode()) {
            return 404;
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
