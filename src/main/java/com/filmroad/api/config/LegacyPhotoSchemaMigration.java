package com.filmroad.api.config;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * <h3>place_photo 1:N (task #45a)</h3>
 * 사라진 `place_photo.image_url` / `group_key` 컬럼을 운영/dev DB 에서 제거.
 * Hibernate `ddl-auto=update` 는 NOT NULL 컬럼을 자동 drop 하지 않아서, 마이그레이션 전
 * schema 가 남아있는 DB 에 INSERT 하면 "Field 'image_url' doesn't have a default value" 로 거부된다.
 *
 * <h3>place scene 1:N (task #place-scene-images)</h3>
 * `place.scene_image_url` / `content_episode` / `scene_timestamp` / `scene_description` 4 컬럼이
 * `place_scene_image` 자식 테이블 (1:N) 로 분리됨. 부팅 시 (1) 4 컬럼을 한 번에 카피해
 * `place_scene_image (image_order_index=0)` 한 줄로 만들고 (2) 4 컬럼 모두 drop. 이미 자식 행이
 * 있는 place 는 건너뜀 → idempotent. 카피 트리거 조건은 image_url 존재(NOT NULL) — 메타만 있고
 * 이미지가 없는 historical row 는 어차피 새 모델에서 표현 불가하므로 drop 으로 손실.
 *
 * 모든 변경은 `IF EXISTS` 또는 `NOT EXISTS` 가드로 idempotent. 컬럼 존재 여부는 information_schema
 * 로 사전에 확인해 SQL 예외 자체를 회피 (예외를 catch 해도 현재 트랜잭션이 rollback-only 로
 * 마킹돼 ApplicationContext 부팅이 깨지는 걸 막기 위함). 모든 dev/운영 DB 가 마이그레이션 끝나면
 * 이 클래스는 삭제 가능.
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

        migrateWorkToContent();
        migratePlaceSceneImage();
    }

    /**
     * 도메인 리네이밍 (Work → Content) — 기존 dev DB 의 work 테이블 / work_id FK 컬럼을
     * 새 이름으로 옮긴다. 이미 새 이름이 있으면 no-op (idempotent).
     *
     * <ol>
     *   <li>RENAME TABLE work TO content (work 만 존재 시)</li>
     *   <li>place.work_id → place.content_id (구 컬럼만 존재 시)</li>
     * </ol>
     *
     * Hibernate ddl-auto=update 는 컬럼/테이블 rename 을 지원하지 않으므로 여기서 손으로
     * 처리. 새 이름이 이미 잡혀 있으면 (신규 부팅) ddl-auto 가 그냥 그대로 사용.
     */
    private void migrateWorkToContent() {
        boolean hasWorkTable = tableExists("work");
        boolean hasContentTable = tableExists("content");
        if (hasWorkTable && !hasContentTable) {
            try {
                em.createNativeQuery("RENAME TABLE work TO content").executeUpdate();
                log.info("renamed legacy table work → content");
            } catch (Exception e) {
                log.warn("RENAME TABLE work → content failed: {}", e.getMessage());
            }
        }

        boolean hasOldFk = columnExists("place", "work_id");
        boolean hasNewFk = columnExists("place", "content_id");
        if (hasOldFk && !hasNewFk) {
            try {
                em.createNativeQuery(
                        "ALTER TABLE place CHANGE COLUMN work_id content_id BIGINT NOT NULL"
                ).executeUpdate();
                log.info("renamed place.work_id → place.content_id");
            } catch (Exception e) {
                log.warn("ALTER place work_id → content_id failed: {}", e.getMessage());
            }
        }

        boolean hasOldBadgeFk = columnExists("badge", "condition_work_id");
        boolean hasNewBadgeFk = columnExists("badge", "condition_content_id");
        if (hasOldBadgeFk && !hasNewBadgeFk) {
            try {
                em.createNativeQuery(
                        "ALTER TABLE badge CHANGE COLUMN condition_work_id condition_content_id BIGINT"
                ).executeUpdate();
                log.info("renamed badge.condition_work_id → badge.condition_content_id");
            } catch (Exception e) {
                log.warn("ALTER badge condition_work_id → condition_content_id failed: {}", e.getMessage());
            }
        }
    }

    private boolean tableExists(String table) {
        try {
            Number n = (Number) em.createNativeQuery(
                    "SELECT COUNT(*) FROM information_schema.tables " +
                    "WHERE table_schema = DATABASE() " +
                    "  AND LOWER(table_name) = LOWER(:t)"
            ).setParameter("t", table).getSingleResult();
            return n != null && n.intValue() > 0;
        } catch (Exception e) {
            log.debug("tableExists check failed for {} : {}", table, e.getMessage());
            return false;
        }
    }

    /**
     * place.{scene_image_url, content_episode, scene_timestamp, scene_description} → place_scene_image 자식 행으로 이전.
     * 이미 같은 place_id 의 scene image 가 있으면 (시드 또는 이전 마이그레이션 결과) 카피 skip.
     *
     * <h4>왜 컬럼 존재 여부를 먼저 보는가</h4>
     * 존재하지 않는 컬럼을 SELECT 하면 SQL 예외가 던져지고, 이를 catch 해도 현재 트랜잭션이
     * `rollback-only` 로 marking 된다. CommandLineRunner 가 Spring 의 application 시작 트랜잭션을
     * 공유한다면 전체 ApplicationContext 로드가 실패한다(=test 부팅 전부 깨짐). information_schema 로
     * 미리 체크해 예외 자체를 회피한다. H2(MODE=MySQL) / MariaDB 모두 동일 쿼리 동작.
     */
    private void migratePlaceSceneImage() {
        boolean hasImage = columnExists("place", "scene_image_url");
        boolean hasEpisode = columnExists("place", "work_episode");
        boolean hasTimestamp = columnExists("place", "scene_timestamp");
        boolean hasDesc = columnExists("place", "scene_description");

        // 이미지가 새 모델의 NOT NULL 키. 이미지 컬럼 자체가 없으면 카피할 게 없음.
        if (hasImage) {
            String episodeExpr = hasEpisode ? "p.work_episode" : "NULL";
            String timestampExpr = hasTimestamp ? "p.scene_timestamp" : "NULL";
            String descExpr = hasDesc ? "p.scene_description" : "NULL";
            int copied = em.createNativeQuery(
                    "INSERT INTO place_scene_image " +
                    "  (place_id, image_url, image_order_index, content_episode, scene_timestamp, scene_description, CREATE_DATE, UPDATE_DATE) " +
                    "SELECT p.id, p.scene_image_url, 0, " +
                    episodeExpr + ", " + timestampExpr + ", " + descExpr + ", " +
                    "       NOW(), NOW() " +
                    "FROM place p " +
                    "WHERE p.scene_image_url IS NOT NULL AND p.scene_image_url <> '' " +
                    "  AND NOT EXISTS (SELECT 1 FROM place_scene_image psi WHERE psi.place_id = p.id)"
            ).executeUpdate();
            if (copied > 0) {
                log.info("migrated {} place.scene_* rows into place_scene_image", copied);
            }
        }

        // 4 컬럼 모두 drop — 메타만 있고 이미지 없는 row 는 자식 테이블로 옮길 수 없으므로 손실 감수.
        dropColumnIfExists("place", "scene_image_url");
        dropColumnIfExists("place", "work_episode");
        dropColumnIfExists("place", "scene_timestamp");
        dropColumnIfExists("place", "scene_description");
    }

    private boolean columnExists(String table, String column) {
        try {
            Number n = (Number) em.createNativeQuery(
                    "SELECT COUNT(*) FROM information_schema.columns " +
                    "WHERE table_schema = DATABASE() " +
                    "  AND LOWER(table_name) = LOWER(:t) " +
                    "  AND LOWER(column_name) = LOWER(:c)"
            ).setParameter("t", table).setParameter("c", column).getSingleResult();
            return n != null && n.intValue() > 0;
        } catch (Exception e) {
            // information_schema 가 다른 dialect 에서 없을 가능성 — 보수적으로 false (skip).
            log.debug("columnExists check failed for {}.{} : {}", table, column, e.getMessage());
            return false;
        }
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
