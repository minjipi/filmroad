package com.filmroad.api;

import com.filmroad.api.integration.kakao.KakaoLocalProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan(basePackageClasses = KakaoLocalProperties.class)
public class FilmroadApplication {

    public static void main(String[] args) {
        SpringApplication.run(FilmroadApplication.class, args);
    }

}
