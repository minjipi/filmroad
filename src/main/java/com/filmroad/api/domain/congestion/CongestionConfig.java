package com.filmroad.api.domain.congestion;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

/**
 * Congestion 도메인의 {@link Clock} 빈 정의. 테스트에서 고정 Clock 으로 override 하여
 * "오늘/내일/주말" 산출을 결정적으로 검증할 수 있도록 분리.
 *
 * <p>존재하는 다른 도메인이 Clock 을 직접 쓰지 않아 별도 컨테이너 빈이 없으므로 여기서 하나
 * 등록한다. 향후 다른 도메인이 같이 쓰게 되면 공용 config 로 이동 검토.</p>
 */
@Configuration
public class CongestionConfig {

    @Bean
    public Clock systemClock() {
        return Clock.system(ZoneId.of("Asia/Seoul"));
    }
}
