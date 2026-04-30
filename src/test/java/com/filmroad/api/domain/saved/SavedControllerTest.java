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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
    @DisplayName("POST /api/saved/collections 유효 name → 201 + CollectionDetailResponse(빈 컬렉션) 반환")
    void createCollection_validName_returns201() throws Exception {
        // task #6: create 응답이 mutate 시 다른 endpoint 와 동일하게 CollectionDetailResponse 통째로 내려옴.
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
                .andExpect(jsonPath("$.results.totalPlaces", is(0)))
                .andExpect(jsonPath("$.results.upcomingPlaces", hasSize(0)))
                .andExpect(jsonPath("$.results.visitedPlacesList", hasSize(0)))
                .andExpect(jsonPath("$.results.coverImageUrl").value(nullValue()))
                .andExpect(jsonPath("$.results.owner.id", is(1)))
                .andExpect(jsonPath("$.results.owner.isMe", is(true)));
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
                .andExpect(jsonPath("$.results.kind", is("CONTENT")))
                .andExpect(jsonPath("$.results.contentTitle", is("도깨비")))
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
                .andExpect(jsonPath("$.results.visitedPlacesList[0].contentId", is(1)))
                .andExpect(jsonPath("$.results.visitedPlacesList[0].contentEpisode",
                        is("5회 00:31:02")))   // 시드 contentEpisode='5회', sceneTimestamp='00:31:02'
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
    @DisplayName("PATCH /api/saved/collections/{id} 유효 name → 200 + 변경된 이름 반환")
    void renameCollection_validName_returns200() throws Exception {
        String body = objectMapper.writeValueAsString(new java.util.HashMap<String, Object>() {{
            put("name", "새 이름");
        }});

        mockMvc.perform(patch("/api/saved/collections/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.id", is(1)))
                .andExpect(jsonPath("$.results.name", is("새 이름")));
    }

    @Test
    @DisplayName("PATCH /api/saved/collections/{id} 빈 name → 400 REQUEST_ERROR")
    void renameCollection_blankName_returns400() throws Exception {
        String body = objectMapper.writeValueAsString(new java.util.HashMap<String, Object>() {{
            put("name", "   ");
        }});

        mockMvc.perform(patch("/api/saved/collections/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(demoAccessCookie()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is(30001)));
    }

    @Test
    @DisplayName("PATCH /api/saved/collections/{id} 21자 → 400 REQUEST_ERROR")
    void renameCollection_tooLong_returns400() throws Exception {
        String tooLong = "가".repeat(21);
        String body = objectMapper.writeValueAsString(new java.util.HashMap<String, Object>() {{
            put("name", tooLong);
        }});

        mockMvc.perform(patch("/api/saved/collections/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(demoAccessCookie()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is(30001)));
    }

    @Test
    @DisplayName("PATCH /api/saved/collections/{id} 다른 유저 소유 → 404 (enumeration 방지)")
    void renameCollection_foreign_returns404() throws Exception {
        User user2 = userRepository.findById(2L).orElseThrow();
        Collection foreign = collectionRepository.save(Collection.builder()
                .user(user2).name("user2 collection").build());

        String body = objectMapper.writeValueAsString(new java.util.HashMap<String, Object>() {{
            put("name", "탈취 시도");
        }});

        mockMvc.perform(patch("/api/saved/collections/" + foreign.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(demoAccessCookie()))   // user=1 토큰
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is(40090)));
    }

    @Test
    @DisplayName("PATCH /api/saved/collections/{id} 비로그인 → 401")
    void renameCollection_unauthenticated_returns401() throws Exception {
        String body = objectMapper.writeValueAsString(new java.util.HashMap<String, Object>() {{
            put("name", "비로그인 시도");
        }});

        mockMvc.perform(patch("/api/saved/collections/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("DELETE /api/saved/collections/{id} → 200 + 컬렉션 + 안의 SavedPlace 모두 삭제")
    void deleteCollection_cascadesSavedPlaces() throws Exception {
        // collection 2 (도깨비 컴플리트) 안에 savedPlace=2 (place 14) 가 있음.
        mockMvc.perform(delete("/api/saved/collections/2").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));

        // GET /api/saved 에 collection 2 가 더 이상 안 나옴 + place 14 도 items 에서 빠짐.
        mockMvc.perform(get("/api/saved").cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.collections[?(@.id == 2)]", hasSize(0)))
                .andExpect(jsonPath("$.results.items[?(@.placeId == 14)]", hasSize(0)));
    }

    @Test
    @DisplayName("DELETE /api/saved/collections/{id} 다른 유저 소유 → 404")
    void deleteCollection_foreign_returns404() throws Exception {
        User user2 = userRepository.findById(2L).orElseThrow();
        Collection foreign = collectionRepository.save(Collection.builder()
                .user(user2).name("user2 collection").build());

        mockMvc.perform(delete("/api/saved/collections/" + foreign.getId())
                        .cookie(demoAccessCookie()))   // user=1 토큰
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is(40090)));
    }

    @Test
    @DisplayName("DELETE /api/saved/collections/{id} 비로그인 → 401")
    void deleteCollection_unauthenticated_returns401() throws Exception {
        mockMvc.perform(delete("/api/saved/collections/1"))
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

    // -----------------------------------------------------------------
    // task #6 — 트립 루트 backend (5 신규 케이스)
    // -----------------------------------------------------------------

    @Test
    @DisplayName("[#6] POST /api/saved/collections placeIds 동봉 → 201 + 입력 순서대로 orderIndex 0..N-1")
    void createCollection_withPlaceIds_assignsOrderInInputOrder() throws Exception {
        // user=1 의 새 트립 컬렉션 생성. place 12, 15 를 입력 순서대로 add.
        // 시드상 user 1 은 place 10~17 모두 stamp 보유 → 두 place 모두 visited 처리되어 visitedPlacesList 로 떨어짐.
        // 입력 순서 [12, 15] 가 orderIndex 1, 2 (1-based) 로 그대로 노출되는지가 핵심.
        String body = objectMapper.writeValueAsString(new java.util.HashMap<String, Object>() {{
            put("name", "강원 1박2일");
            put("description", "춘천부터 강릉까지");
            put("placeIds", java.util.List.of(12L, 15L));
        }});

        mockMvc.perform(post("/api/saved/collections")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(demoAccessCookie()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.results.totalPlaces", is(2)))
                .andExpect(jsonPath("$.results.subtitle", is("춘천부터 강릉까지")))
                .andExpect(jsonPath("$.results.upcomingPlaces", hasSize(0)))
                .andExpect(jsonPath("$.results.visitedPlacesList[0].id", is(12)))
                .andExpect(jsonPath("$.results.visitedPlacesList[0].orderIndex", is(1)))
                .andExpect(jsonPath("$.results.visitedPlacesList[1].id", is(15)))
                .andExpect(jsonPath("$.results.visitedPlacesList[1].orderIndex", is(2)));
    }

    @Test
    @DisplayName("[#6] POST /api/saved/collections/{id}/places → 컬렉션 끝에 append + userNote 반영")
    void addPlaceToCollection_appendsAtEnd_withUserNote() throws Exception {
        // 시드 collection 1 — 안에 place 10 (orderIndex=0). place 12 를 메모와 함께 추가.
        // place 12 도 visited (시드 stamp) → visitedPlacesList 끝에 추가되어 orderIndex 1-based=2.
        String body = objectMapper.writeValueAsString(new java.util.HashMap<String, Object>() {{
            put("placeId", 12L);
            put("userNote", "맛집 골목 점심");
        }});

        mockMvc.perform(post("/api/saved/collections/1/places")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.totalPlaces", is(2)))
                .andExpect(jsonPath("$.results.visitedPlacesList[?(@.id == 12)].userNote",
                        contains("맛집 골목 점심")))
                .andExpect(jsonPath("$.results.visitedPlacesList[?(@.id == 12)].orderIndex",
                        contains(2)));
    }

    @Test
    @DisplayName("[#6] DELETE /api/saved/collections/{id}/places/{placeId} → 해당 SavedPlace 만 제거")
    void removePlaceFromCollection_deletesOnlyTarget() throws Exception {
        // 사전: collection 1 에 place 12 추가 → 안에 place 10 (visited) + place 12 (upcoming) = 2개.
        addPlaceForSetup(1L, 12L, null);

        mockMvc.perform(delete("/api/saved/collections/1/places/12")
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.totalPlaces", is(1)))
                // 제거된 place 12 는 양쪽 리스트 모두에서 사라져야 함.
                .andExpect(jsonPath("$.results.upcomingPlaces[?(@.id == 12)]", hasSize(0)))
                .andExpect(jsonPath("$.results.visitedPlacesList[?(@.id == 12)]", hasSize(0)))
                // 원래 있던 place 10 은 그대로 남아 visited 리스트에 유지.
                .andExpect(jsonPath("$.results.visitedPlacesList[?(@.id == 10)]", hasSize(1)));
    }

    @Test
    @DisplayName("[#6] PATCH /api/saved/collections/{id}/order → 입력 순서대로 orderIndex 갱신")
    void reorderCollection_appliesNewOrder() throws Exception {
        // 사전: collection 1 에 place 12 추가 → place 10, 12 (둘 다 user=1 시드 stamp 로 visited).
        addPlaceForSetup(1L, 12L, null);

        // 순서 뒤집어서 [12, 10] 으로 reorder → visitedPlacesList 가 [12, 10] 으로 재배치, orderIndex 1, 2.
        String body = objectMapper.writeValueAsString(new java.util.HashMap<String, Object>() {{
            put("placeIds", java.util.List.of(12L, 10L));
        }});

        mockMvc.perform(patch("/api/saved/collections/1/order")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.totalPlaces", is(2)))
                .andExpect(jsonPath("$.results.upcomingPlaces", hasSize(0)))
                .andExpect(jsonPath("$.results.visitedPlacesList[0].id", is(12)))
                .andExpect(jsonPath("$.results.visitedPlacesList[0].orderIndex", is(1)))
                .andExpect(jsonPath("$.results.visitedPlacesList[1].id", is(10)))
                .andExpect(jsonPath("$.results.visitedPlacesList[1].orderIndex", is(2)));
    }

    @Test
    @DisplayName("[#6] PATCH /api/saved/collections/{id}/places/{placeId}/note → userNote 갱신")
    void updatePlaceNote_appliesNewNote() throws Exception {
        // 사전: collection 1 의 place 10 (visited 상태) 메모를 새 값으로 갱신.
        String body = objectMapper.writeValueAsString(new java.util.HashMap<String, Object>() {{
            put("userNote", "방파제 일출 — 빨간 목도리 필수");
        }});

        mockMvc.perform(patch("/api/saved/collections/1/places/10/note")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk())
                // place 10 은 visited 상태 → visitedPlacesList 에 위치.
                .andExpect(jsonPath("$.results.visitedPlacesList[?(@.id == 10)].userNote",
                        contains("방파제 일출 — 빨간 목도리 필수")));
    }

    /** task #6 신규 케이스 공통 setup — collection 에 place 1건을 추가해 두는 헬퍼. */
    private void addPlaceForSetup(Long collectionId, Long placeId, String userNote) throws Exception {
        String body = objectMapper.writeValueAsString(new java.util.HashMap<String, Object>() {{
            put("placeId", placeId);
            if (userNote != null) put("userNote", userNote);
        }});
        mockMvc.perform(post("/api/saved/collections/" + collectionId + "/places")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .cookie(demoAccessCookie()))
                .andExpect(status().isOk());
    }
}
