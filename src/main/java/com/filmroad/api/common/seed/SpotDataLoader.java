package com.filmroad.api.common.seed;

import com.filmroad.api.domain.place.Place;
import com.filmroad.api.domain.place.PlaceRepository;
import com.filmroad.api.domain.work.Work;
import com.filmroad.api.domain.work.WorkRepository;
import com.filmroad.api.domain.work.WorkType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * data/spot_data.csv 15K 행을 앱 시작 시 1회 로드해 Work/Place를 등록.
 * countThreshold 가드로 이후 기동에는 건너뛰어 idempotent.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SpotDataLoader implements ApplicationRunner {

    private static final int BATCH_SIZE = 500;

    private final WorkRepository workRepository;
    private final PlaceRepository placeRepository;

    @Value("${filmroad.seed.spot.path:./data/spot_data.csv}")
    private String csvPath;

    @Value("${filmroad.seed.spot.enabled:true}")
    private boolean enabled;

    @Value("${filmroad.seed.spot.countThreshold:100}")
    private long countThreshold;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!enabled) {
            log.info("SpotDataLoader: disabled, skip");
            return;
        }
        long current = placeRepository.count();
        if (current >= countThreshold) {
            log.info("SpotDataLoader: places={} >= threshold={}, skip", current, countThreshold);
            return;
        }
        Path path = Paths.get(csvPath);
        if (!Files.exists(path)) {
            log.warn("SpotDataLoader: csv not found at {}, skip", path.toAbsolutePath());
            return;
        }
        loadInternal(path);
    }

    // 테스트 용도로 공개. 프로덕션 호출은 run()을 통해서만.
    public LoadResult loadInternal(Path path) {
        Map<String, Work> workCache = new HashMap<>();
        Set<String> existingKeys = loadExistingKeys();
        List<Place> buffer = new ArrayList<>(BATCH_SIZE);

        int inserted = 0;
        int skippedDuplicate = 0;
        int failed = 0;

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(Files.newInputStream(path), Charset.forName("CP949")));
             CSVParser parser = new CSVParser(reader, CSVFormat.DEFAULT.builder()
                     .setHeader()
                     .setSkipHeaderRecord(true)
                     .build())) {

            int row = 0;
            for (CSVRecord record : parser) {
                row++;
                try {
                    String mediaType = safeGet(record, 1);
                    String title = safeGet(record, 2);
                    String placeName = safeGet(record, 3);
                    String placeType = safeGet(record, 4);
                    String description = safeGet(record, 5);
                    String operatingHours = safeGet(record, 6);
                    String address = safeGet(record, 9);
                    String latStr = safeGet(record, 10);
                    String lngStr = safeGet(record, 11);
                    String phone = safeGet(record, 12);

                    if (title == null || title.isBlank() || placeName == null || placeName.isBlank()
                            || latStr == null || lngStr == null) {
                        failed++;
                        continue;
                    }
                    double lat = Double.parseDouble(latStr.trim());
                    double lng = Double.parseDouble(lngStr.trim());

                    String dupeKey = dedupeKey(placeName, lat, lng);
                    if (existingKeys.contains(dupeKey)) {
                        skippedDuplicate++;
                        continue;
                    }
                    existingKeys.add(dupeKey);

                    Work work = workCache.computeIfAbsent(title, t ->
                            workRepository.findByTitle(t).orElseGet(() ->
                                    workRepository.save(Work.builder()
                                            .title(t)
                                            .type(resolveType(mediaType))
                                            .build())));

                    buffer.add(Place.builder()
                            .name(placeName)
                            .regionLabel(extractRegionLabel(address))
                            .latitude(lat)
                            .longitude(lng)
                            .work(work)
                            .trendingScore(0)
                            .address(address)
                            .placeType(placeType)
                            .phone(phone)
                            .operatingHours(operatingHours)
                            .sceneDescription(description)
                            .build());

                    if (buffer.size() >= BATCH_SIZE) {
                        placeRepository.saveAll(buffer);
                        inserted += buffer.size();
                        buffer.clear();
                    }
                    if (row % 1000 == 0) {
                        log.info("SpotDataLoader progress: row={}, inserted={}, skipped={}, failed={}",
                                row, inserted, skippedDuplicate, failed);
                    }
                } catch (NumberFormatException ex) {
                    failed++;
                    log.warn("SpotDataLoader: numeric parse failed at row {}: {}", row, ex.getMessage());
                } catch (Exception ex) {
                    failed++;
                    log.warn("SpotDataLoader: row {} skipped: {}", row, ex.getMessage());
                }
            }
            if (!buffer.isEmpty()) {
                placeRepository.saveAll(buffer);
                inserted += buffer.size();
            }
        } catch (IOException ex) {
            log.error("SpotDataLoader: csv read failed: {}", ex.getMessage(), ex);
        }

        LoadResult result = new LoadResult(inserted, skippedDuplicate, failed);
        log.info("SpotDataLoader summary: inserted={}, skippedDuplicate={}, failed={}",
                result.inserted, result.skippedDuplicate, result.failed);
        return result;
    }

    private Set<String> loadExistingKeys() {
        Set<String> keys = new HashSet<>();
        for (Place p : placeRepository.findAll()) {
            keys.add(dedupeKey(p.getName(), p.getLatitude(), p.getLongitude()));
        }
        return keys;
    }

    private static String dedupeKey(String name, double lat, double lng) {
        return name + "|" + lat + "|" + lng;
    }

    private static WorkType resolveType(String mediaType) {
        if (mediaType == null) return WorkType.UNKNOWN;
        return switch (mediaType.trim().toLowerCase()) {
            case "drama" -> WorkType.DRAMA;
            case "movie" -> WorkType.MOVIE;
            case "show" -> WorkType.SHOW;
            default -> WorkType.UNKNOWN;
        };
    }

    private static String extractRegionLabel(String address) {
        if (address == null || address.isBlank()) return "";
        String[] parts = address.trim().split("\\s+");
        if (parts.length >= 2) return parts[0] + " " + parts[1];
        return parts[0];
    }

    private static String safeGet(CSVRecord record, int idx) {
        if (idx >= record.size()) return null;
        String v = record.get(idx);
        if (v == null) return null;
        String trimmed = v.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record LoadResult(int inserted, int skippedDuplicate, int failed) {
    }
}
