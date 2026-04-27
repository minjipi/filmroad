package com.filmroad.api;

import com.filmroad.api.integration.kakao.KakaoLocalProperties;
import com.filmroad.api.integration.koreatourism.KoreaTourismProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan(basePackageClasses = {KakaoLocalProperties.class, KoreaTourismProperties.class})
public class FilmroadApplication {

    public static void main(String[] args) {
        SpringApplication.run(FilmroadApplication.class, args);
    }

}
