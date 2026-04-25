package com.filmroad.api.config;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * task #45a 의 1:N 모델 전환으로 사라진 `place_photo.image_url` / `group_key`
 * 컬럼을 운영/dev DB 에서 제거. Hibernate `ddl-auto=update` 는 NOT NULL 컬럼을
 * 자동 drop 하지 않아서, 마이그레이션 전 schema 가 남아있는 DB 에 INSERT 하면
 * "Field 'image_url' doesn't have a default value" 로 거부된다.
 *
 * `IF EXISTS` 로 idempotent — 컬럼이 없으면 no-op. 모든 dev DB 가 마이그레이션
 * 끝나면 이 클래스는 삭제 가능.
 */
@Slf4j
@Component
public class LegacyPhotoSchemaMigration implements CommandLineRunner {

    @PersistenceContext
    private EntityManager em;

    @Override
    @Transactional
    public void run(String... args) {
        dropColumnIfExists("place_photo", "image_url");
        dropColumnIfExists("place_photo", "group_key");
    }

    private void dropColumnIfExists(String table, String column) {
        try {
            em.createNativeQuery(
                    "ALTER TABLE " + table + " DROP COLUMN IF EXISTS " + column
            ).executeUpdate();
        } catch (Exception e) {
            log.warn("legacy column drop failed (likely already dropped): {}.{} — {}", table, column, e.getMessage());
        }
    }
}
