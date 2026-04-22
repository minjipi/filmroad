package com.filmroad.api.domain.saved;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.filmroad.api.domain.auth.JwtTokenService;
import com.filmroad.api.domain.saved.dto.ToggleSaveRequest;
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
    @DisplayName("POST /api/saved/toggle twice flips saved state on then off")
    void toggleSave_twice_flipsState() throws Exception {
        ToggleSaveRequest req = new ToggleSaveRequest(12L);
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
