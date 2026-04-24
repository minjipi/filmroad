package com.filmroad.api.domain.saved;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.filmroad.api.domain.auth.JwtTokenService;
import com.filmroad.api.domain.saved.dto.ToggleSaveRequest;
import com.filmroad.api.domain.user.User;
import com.filmroad.api.domain.user.UserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class SavedControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private CollectionRepository collectionRepository;

    @Autowired
    private UserRepository userRepository;

    private Cookie demoAccessCookie() {
        return new Cookie("ATOKEN", jwtTokenService.issueAccess(1L));
    }

    @Test
    @DisplayName("GET /api/saved returns seeded collections and saved items")
    void getSaved_returnsSeedData() throws Exception {
        mockMvc.perform(get("/api/saved").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.collections", hasSize(greaterThanOrEqualTo(3))))
                .andExpect(jsonPath("$.results.items", hasSize(greaterThanOrEqualTo(4))))
                .andExpect(jsonPath("$.results.totalCount", greaterThanOrEqualTo(4)));
    }

    @Test
    @DisplayName("GET /api/saved?lat=&lng= adds distanceKm and nearbyRouteSuggestion when coords given")
    void getSaved_withCoords_addsDistanceAndSuggestion() throws Exception {
        mockMvc.perform(get("/api/saved")
                        .param("lat", "37.55")
                        .param("lng", "126.99")
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.items[0].distanceKm", notNullValue()))
                .andExpect(jsonPath("$.results.nearbyRouteSuggestion.placeCount", greaterThanOrEqualTo(2)));
    }

    @Test
    @DisplayName("POST /api/saved/collections 유효 name → 201 + count=0 + id 존재")
    void createCollection_validName_returns201() throws Exception {
        String body = objectMapper.writeValueAsString(new java.util.HashMap<String, Object>() {{
            put("name", "제주 힐링 코스");
        }});

        mockMvc.perform(post("/api/saved/collections")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(demoAccessCookie()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.id", notNullValue()))
                .andExpect(jsonPath("$.results.name", is("제주 힐링 코스")))
                .andExpect(jsonPath("$.results.count", is(0)))
                .andExpect(jsonPath("$.results.coverImageUrl").value(nullValue()));
    }

    @Test
    @DisplayName("POST /api/saved/collections 빈 name(공백만) → 400 REQUEST_ERROR")
    void createCollection_blankName_returns400() throws Exception {
        String body = objectMapper.writeValueAsString(new java.util.HashMap<String, Object>() {{
            put("name", "   ");
        }});

        mockMvc.perform(post("/api/saved/collections")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(demoAccessCookie()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is(30001)));
    }

    @Test
    @DisplayName("POST /api/saved/collections 비로그인 → 401 INVALID_JWT")
    void createCollection_unauthenticated_returns401() throws Exception {
        String body = objectMapper.writeValueAsString(new java.util.HashMap<String, Object>() {{
            put("name", "비로그인 시도");
        }});

        mockMvc.perform(post("/api/saved/collections")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/saved/toggle with collectionId → save 후 /api/saved items 에 collectionId 반영")
    void toggleSave_withCollectionId_assignsToCollection() throws Exception {
        // place 12 는 user=1 의 seed 저장 목록에 없음. collection 2(도깨비 컴플리트)에 담도록 지정.
        ToggleSaveRequest req = new ToggleSaveRequest(12L, 2L);
        String body = objectMapper.writeValueAsString(req);

        mockMvc.perform(post("/api/saved/toggle")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.saved", is(true)));

        // 재조회에서 placeId=12 항목의 collectionId 가 2 로 설정됐는지 확인.
        mockMvc.perform(get("/api/saved").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.items[?(@.placeId == 12)].collectionId",
                        contains(2)));
    }

    @Test
    @DisplayName("POST /api/saved/toggle with unknown collectionId → 404 COLLECTION_NOT_FOUND")
    void toggleSave_unknownCollectionId_returns404() throws Exception {
        ToggleSaveRequest req = new ToggleSaveRequest(12L, 9_999_999L);
        String body = objectMapper.writeValueAsString(req);

        mockMvc.perform(post("/api/saved/toggle")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(demoAccessCookie()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is(40090)));
    }

    @Test
    @DisplayName("POST /api/saved/toggle with collectionId owned by another user → 404 COLLECTION_NOT_FOUND")
    void toggleSave_foreignCollection_returns404() throws Exception {
        // user 2 소유의 Collection 을 실제로 DB 에 만들어 두고, user 1 토큰으로 저장 시도.
        User user2 = userRepository.findById(2L).orElseThrow();
        Collection foreign = collectionRepository.save(Collection.builder()
                .user(user2)
                .name("user2 전용 컬렉션")
                .build());

        ToggleSaveRequest req = new ToggleSaveRequest(12L, foreign.getId());
        String body = objectMapper.writeValueAsString(req);

        mockMvc.perform(post("/api/saved/toggle")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(demoAccessCookie()))   // user=1 의 ATOKEN
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is(40090)));
    }

    @Test
    @DisplayName("GET /api/saved/collections/{id} (collection 2: 도깨비 컴플리트) → kind=WORK + 방문/인증 집계 + upcoming/visited 분리")
    void getCollectionDetail_byOwner_returnsDetailWithProgress() throws Exception {
        // 시드: collection 2 → savedPlace 2 (place=14, 덕수궁 돌담길, work=1 도깨비).
        // user=1 은 place=14 에 stamp(2) 도 있고 place_photo 140/145 도 user_id=1 → visited + certified.
        mockMvc.perform(get("/api/saved/collections/2").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.id", is(2)))
                .andExpect(jsonPath("$.results.name", is("도깨비 컴플리트")))
                .andExpect(jsonPath("$.results.kind", is("WORK")))
                .andExpect(jsonPath("$.results.workTitle", is("도깨비")))
                .andExpect(jsonPath("$.results.privacy", is("PRIVATE")))
                .andExpect(jsonPath("$.results.owner.id", is(1)))
                .andExpect(jsonPath("$.results.owner.isMe", is(true)))
                .andExpect(jsonPath("$.results.totalPlaces", is(1)))
                .andExpect(jsonPath("$.results.visitedPlaces", is(1)))
                .andExpect(jsonPath("$.results.certifiedPlaces", is(1)))
                // place 1개라 route 거리는 null (경로 계산 의미 없음)
                .andExpect(jsonPath("$.results.totalDistanceKm").value(nullValue()))
                // upcoming 은 빈 배열, visited 에만 1건.
                .andExpect(jsonPath("$.results.upcomingPlaces", hasSize(0)))
                .andExpect(jsonPath("$.results.visitedPlacesList", hasSize(1)))
                .andExpect(jsonPath("$.results.visitedPlacesList[0].id", is(14)))
                .andExpect(jsonPath("$.results.visitedPlacesList[0].orderIndex", is(1)))
                .andExpect(jsonPath("$.results.visitedPlacesList[0].workId", is(1)))
                .andExpect(jsonPath("$.results.visitedPlacesList[0].workEpisode",
                        is("5회 00:31:02")))   // 시드 workEpisode='5회', sceneTimestamp='00:31:02'
                .andExpect(jsonPath("$.results.visitedPlacesList[0].visited", is(true)))
                .andExpect(jsonPath("$.results.visitedPlacesList[0].certified", is(true)));
    }

    @Test
    @DisplayName("GET /api/saved/collections/1 + lat/lng → place 10 certified=true + distanceKm 채움")
    void getCollectionDetail_withCoords_returnsDistanceAndCertified() throws Exception {
        // place 10 (주문진, 37.89/128.83). photo 100, 105 user_id=1 → certified=true.
        mockMvc.perform(get("/api/saved/collections/1")
                        .param("lat", "37.89")
                        .param("lng", "128.83")
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.visitedPlacesList[0].id", is(10)))
                .andExpect(jsonPath("$.results.visitedPlacesList[0].certified", is(true)))
                .andExpect(jsonPath("$.results.visitedPlacesList[0].distanceKm", lessThan(5.0)));
    }

    @Test
    @DisplayName("GET /api/saved/collections/999 (없음) → 404 COLLECTION_NOT_FOUND")
    void getCollectionDetail_unknown_returns404() throws Exception {
        mockMvc.perform(get("/api/saved/collections/999999").cookie(demoAccessCookie()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is(40090)));
    }

    @Test
    @DisplayName("GET /api/saved/collections/{id} — 다른 유저 소유 → 404 (enumeration 방지)")
    void getCollectionDetail_foreign_returns404() throws Exception {
        User user2 = userRepository.findById(2L).orElseThrow();
        Collection foreign = collectionRepository.save(Collection.builder()
                .user(user2).name("user2 collection").build());

        mockMvc.perform(get("/api/saved/collections/" + foreign.getId())
                        .cookie(demoAccessCookie()))   // user=1 토큰
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is(40090)));
    }

    @Test
    @DisplayName("GET /api/saved/collections/{id} 비로그인 → 401")
    void getCollectionDetail_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/saved/collections/2"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/saved/toggle twice flips saved state on then off")
    void toggleSave_twice_flipsState() throws Exception {
        ToggleSaveRequest req = new ToggleSaveRequest(12L, null);
        String body = objectMapper.writeValueAsString(req);

        mockMvc.perform(post("/api/saved/toggle")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.saved", is(true)));

        mockMvc.perform(post("/api/saved/toggle")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.saved", is(false)));
    }
}
