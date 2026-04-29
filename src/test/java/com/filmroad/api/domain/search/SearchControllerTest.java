package com.filmroad.api.domain.search;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.lessThanOrEqualTo;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SearchControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("GET /api/search?q=이태원 → contents + places 섹션에 매칭 반환")
    void search_byTerm_returnsHitsInBothSections() throws Exception {
        mockMvc.perform(get("/api/search").param("q", "이태원"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.query", is("이태원")))
                // 시드상 work 2 의 title 이 "이태원 클라쓰" 라서 contents 섹션에 포함돼야 한다.
                .andExpect(jsonPath("$.results.contents[*].id", hasItem(is(2))))
                .andExpect(jsonPath("$.results.contents[*].placeCount",
                        everyItem(greaterThanOrEqualTo(0))))
                // place 13(이태원)·16(녹사평) 의 regionLabel 에 "이태원" 포함.
                .andExpect(jsonPath("$.results.places", not(empty())))
                .andExpect(jsonPath("$.results.places[*].regionLabel",
                        everyItem(anyOf(containsString("이태원"), containsString("이태원동")))))
                .andExpect(jsonPath("$.results.places[*].contentId",
                        everyItem(greaterThan(0))));
    }

    @Test
    @DisplayName("GET /api/search?q=단밤 → 장소명(place.name) 단독 매칭 (content.title 엔 없음)")
    void search_byPlaceName_matchesOnPlaceNameOnly() throws Exception {
        // 시드상 "단밤 포차 (서울밤)" 만 name 에 '단밤' 포함. content.title/region 엔 없어서 contents 는 비어야 함.
        mockMvc.perform(get("/api/search").param("q", "단밤"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.contents", hasSize(0)))
                .andExpect(jsonPath("$.results.places", not(empty())))
                .andExpect(jsonPath("$.results.places[*].name",
                        everyItem(containsString("단밤"))))
                .andExpect(jsonPath("$.results.places[*].id", hasItem(is(13))));
    }

    @Test
    @DisplayName("GET /api/search?q=강릉시 → 지역명(regionLabel) 단독 매칭")
    void search_byRegionLabel_matchesOnRegionOnly() throws Exception {
        // '강릉시' 는 place 10 의 regionLabel='강릉시 주문진읍' 에만 있음. contents 에는 없어야 함.
        mockMvc.perform(get("/api/search").param("q", "강릉시"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.contents", hasSize(0)))
                .andExpect(jsonPath("$.results.places[*].id", hasItem(is(10))))
                .andExpect(jsonPath("$.results.places[*].regionLabel",
                        everyItem(containsString("강릉시"))));
    }

    @Test
    @DisplayName("GET /api/search?q=zzz → 양 섹션 모두 빈 배열")
    void search_noMatch_returnsEmptySections() throws Exception {
        mockMvc.perform(get("/api/search").param("q", "zzz-no-such-term-zzz"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.contents", hasSize(0)))
                .andExpect(jsonPath("$.results.places", hasSize(0)));
    }

    @Test
    @DisplayName("GET /api/search 빈 q (공백만) → 400 REQUEST_ERROR")
    void search_blankQuery_returns400() throws Exception {
        mockMvc.perform(get("/api/search").param("q", "   "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is(30001)));
    }

    @Test
    @DisplayName("GET /api/search?q=도&limit=1 → contents/places 각 섹션이 1건 이하")
    void search_limitApplied_cappedPerSection() throws Exception {
        mockMvc.perform(get("/api/search")
                        .param("q", "도")
                        .param("limit", "1"))
                .andExpect(status().isOk())
                // 시드상 "도깨비", "덕수궁 돌담길", "주문진" 등 '도' 로 매칭되는 행이 여러 개 → limit=1 로 캡.
                .andExpect(jsonPath("$.results.contents", hasSize(lessThanOrEqualTo(1))))
                .andExpect(jsonPath("$.results.places", hasSize(lessThanOrEqualTo(1))));
    }

    @Test
    @DisplayName("GET /api/search?q=도깨비 → 작품 섹션 placeCount 가 실제 장소 수와 일치")
    void search_worksSection_placeCountIsAccurate() throws Exception {
        // 시드에 content_id=1('도깨비') 로 묶인 place: 10 주문진, 14 덕수궁 → placeCount=2.
        mockMvc.perform(get("/api/search").param("q", "도깨비"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.contents[0].id", is(1)))
                .andExpect(jsonPath("$.results.contents[0].title", is("도깨비")))
                .andExpect(jsonPath("$.results.contents[0].placeCount", is(2)));
    }
}
