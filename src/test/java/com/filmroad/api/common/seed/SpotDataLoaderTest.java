package com.filmroad.api.common.seed;

import com.filmroad.api.domain.place.PlaceRepository;
import com.filmroad.api.domain.work.WorkRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Path;
import java.nio.file.Paths;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SpotDataLoaderTest {

    @Autowired
    private SpotDataLoader spotDataLoader;

    @Autowired
    private PlaceRepository placeRepository;

    @Autowired
    private WorkRepository workRepository;

    @Test
    @DisplayName("5-row CP949 CSV loads 5 places + upserts works")
    void loadInternal_parsesCp949Fixture() {
        long placesBefore = placeRepository.count();
        long worksBefore = workRepository.count();

        Path fixture = Paths.get("src/test/resources/seed/test-spot.csv");
        SpotDataLoader.LoadResult result = spotDataLoader.loadInternal(fixture);

        assertThat(result.inserted()).isEqualTo(5);
        assertThat(placeRepository.count()).isEqualTo(placesBefore + 5);
        // 5행 중 unique title 4종(테스트드라마 2회, 테스트영화, 테스트예능, 테스트기타)
        assertThat(workRepository.count() - worksBefore).isGreaterThanOrEqualTo(3);
    }

    @Test
    @DisplayName("second load on same fixture dedupes on (name, lat, lng) key")
    void loadInternal_secondRun_deduplicates() {
        Path fixture = Paths.get("src/test/resources/seed/test-spot.csv");
        spotDataLoader.loadInternal(fixture);
        SpotDataLoader.LoadResult second = spotDataLoader.loadInternal(fixture);

        assertThat(second.inserted()).isEqualTo(0);
        assertThat(second.skippedDuplicate()).isEqualTo(5);
    }

    @Test
    @DisplayName("missing file path returns LoadResult with 0s and no exception")
    void loadInternal_missingFile_returnsEmpty() {
        Path missing = Paths.get("src/test/resources/seed/does-not-exist.csv");
        // run()이 아니라 loadInternal()을 직접 호출. 존재하지 않으면 inserted=0 반환.
        // (run() 경로는 enabled/count/파일존재 가드가 먼저 잡아 skip)
        SpotDataLoader.LoadResult result = spotDataLoader.loadInternal(missing);
        assertThat(result.inserted()).isEqualTo(0);
        assertThat(result.failed()).isEqualTo(0);
    }
}
