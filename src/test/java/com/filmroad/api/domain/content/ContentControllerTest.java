package com.filmroad.api.domain.content;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ContentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("GET /api/contents/1 returns 도깨비 detail with progress and spots")
    void getContent_existing_returnsDetail() throws Exception {
        mockMvc.perform(get("/api/contents/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.content.id", is(1)))
                .andExpect(jsonPath("$.results.content.title", is("도깨비")))
                .andExpect(jsonPath("$.results.content.synopsis", containsString("도깨비")))
                .andExpect(jsonPath("$.results.content.yearStart", is(2016)))
                .andExpect(jsonPath("$.results.content.network", is("tvN")))
                .andExpect(jsonPath("$.results.progress.totalCount", greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.results.spots", not(empty())));
    }

    @Test
    @DisplayName("GET /api/contents/99999 returns 404 WORK_NOT_FOUND")
    void getContent_unknown_returnsNotFound() throws Exception {
        mockMvc.perform(get("/api/contents/99999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(40051)));
    }
}
