package com.filmroad.api.domain.place;

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
class GalleryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("GET /api/places/10/photos returns paged gallery with header and default RECENT sort")
    void getPhotos_defaultSort_returnsRecentPage() throws Exception {
        mockMvc.perform(get("/api/places/10/photos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.results.place.placeId", is(10)))
                .andExpect(jsonPath("$.results.place.workTitle", is("도깨비")))
                .andExpect(jsonPath("$.results.photos", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.results.sort", is("RECENT")))
                .andExpect(jsonPath("$.results.total", greaterThanOrEqualTo(6)));
    }

    @Test
    @DisplayName("GET /api/places/10/photos?sort=POPULAR&size=3 returns 3 items with POPULAR sort")
    void getPhotos_popularSort_respectsSizeAndSort() throws Exception {
        mockMvc.perform(get("/api/places/10/photos")
                        .param("sort", "POPULAR")
                        .param("size", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.sort", is("POPULAR")))
                .andExpect(jsonPath("$.results.photos", hasSize(3)))
                .andExpect(jsonPath("$.results.size", is(3)));
    }
}
