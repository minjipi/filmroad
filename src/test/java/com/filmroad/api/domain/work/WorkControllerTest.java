package com.filmroad.api.domain.work;

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
class WorkControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("GET /api/works/1 returns 도깨비 detail with progress and spots")
    void getWork_existing_returnsDetail() throws Exception {
        mockMvc.perform(get("/api/works/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.work.id", is(1)))
                .andExpect(jsonPath("$.results.work.title", is("도깨비")))
                .andExpect(jsonPath("$.results.work.synopsis", containsString("도깨비")))
                .andExpect(jsonPath("$.results.work.yearStart", is(2016)))
                .andExpect(jsonPath("$.results.work.network", is("tvN")))
                .andExpect(jsonPath("$.results.progress.totalCount", greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.results.spots", not(empty())));
    }

    @Test
    @DisplayName("GET /api/works/99999 returns 404 WORK_NOT_FOUND")
    void getWork_unknown_returnsNotFound() throws Exception {
        mockMvc.perform(get("/api/works/99999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.code", is(40051)));
    }
}
