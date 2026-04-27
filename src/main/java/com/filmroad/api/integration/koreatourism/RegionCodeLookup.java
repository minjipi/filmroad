package com.filmroad.api.integration.koreatourism;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * 264 개 시군구 매핑 lookup. 부팅 시 `classpath:data/koreaTourism-region-codes-raw.json` 을
 * 1회 로드하여 메모리 Map(regionName → RegionCode) 으로 보관.
 *
 * <h3>JSON 포맷 (한국관광공사 ldongCode2 raw 응답 그대로)</h3>
 * <pre>
 * {
 *   "response": {
 *     "header": { ... },
 *     "body": {
 *       "items": {
 *         "item": [
 *           { "lDongRegnCd": "11", "lDongRegnNm": "서울특별시", "lDongSignguCd": "110", "lDongSignguNm": "종로구", "rnum": 1 },
 *           { "lDongRegnCd": "51", "lDongRegnNm": "강원특별자치도", "lDongSignguCd": "750", "lDongSignguNm": "영월군", "rnum": 153 }
 *         ]
 *       }
 *     }
 *   }
 * }
 * </pre>
 *
 * <h3>Lookup 전략</h3>
 * <ol>
 *   <li>regionLabel 또는 address 중 하나 (또는 둘 모두 시도) 를 input 으로 받음</li>
 *   <li>1차: 정확히 매칭되는 "광역 시군구" 정규화 문자열 (예: "서울특별시종로구") 을 찾음</li>
 *   <li>2차: 광역 토큰 + 시군구 토큰이 input 에 모두 포함되면 매칭 (예: "강원 영월" → "강원특별자치도 영월군")</li>
 *   <li>실패 시 {@link Optional#empty()} — 호출자가 좌표만으로 외부 API 호출 (보조 필터 누락 OK)</li>
 * </ol>
 *
 * <p>매핑 JSON 이 비어있거나 로드 실패 시에도 startup 은 계속 진행 — endpoint 가 좌표 fallback
 * 으로 동작하면 됨. 하드 의존하지 않음.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RegionCodeLookup {

    private static final String CLASSPATH_RESOURCE = "data/koreaTourism-region-codes-raw.json";

    private final ObjectMapper objectMapper;

    /** regionName 정확 매칭용. lookup 입력의 정규화 결과를 key 로 사용. */
    private Map<String, RegionCode> exactByName = Map.of();

    /** 토큰 검색용 (광역+시군구 양쪽 토큰이 input 에 모두 등장하면 매칭). */
    private Map<RegionTokenKey, RegionCode> byTokens = Map.of();

    @PostConstruct
    void load() {
        try (InputStream in = new ClassPathResource(CLASSPATH_RESOURCE).getInputStream()) {
            JsonNode root = objectMapper.readTree(in);
            JsonNode items = extractItemsArray(root);
            if (items == null || !items.isArray() || items.isEmpty()) {
                log.warn("[REGION] {} 의 response.body.items.item[] 이 없거나 비어있음 — 매핑 lookup 비활성",
                        CLASSPATH_RESOURCE);
                return;
            }
            Map<String, RegionCode> exact = new HashMap<>();
            Map<RegionTokenKey, RegionCode> tokens = new HashMap<>();
            for (JsonNode node : items) {
                String regnNm = textOrNull(node.get("lDongRegnNm"));
                String siggNm = textOrNull(node.get("lDongSignguNm"));
                String regnCd = textOrNull(node.get("lDongRegnCd"));
                String siggCd = textOrNull(node.get("lDongSignguCd"));
                if (regnNm == null || regnCd == null || siggCd == null) continue;
                RegionCode code = new RegionCode(regnCd, siggCd);
                String composedName = siggNm == null ? regnNm : (regnNm + " " + siggNm);
                exact.put(normalize(composedName), code);
                if (siggNm != null) {
                    tokens.putIfAbsent(new RegionTokenKey(regnNm, siggNm), code);
                }
            }
            this.exactByName = Map.copyOf(exact);
            this.byTokens = Map.copyOf(tokens);
            log.info("[REGION] 매핑 로드 완료 — {}개 (token-key {}개)", exactByName.size(), byTokens.size());
        } catch (IOException e) {
            log.warn("[REGION] {} 로드 실패 — 매핑 lookup 비활성: {}", CLASSPATH_RESOURCE, e.toString());
        }
    }

    /** raw 응답 트리에서 items.item 배열 추출. 형식 변형은 모두 null 로 fallback. */
    private static JsonNode extractItemsArray(JsonNode root) {
        if (root == null) return null;
        JsonNode response = root.get("response");
        if (response == null) return null;
        JsonNode body = response.get("body");
        if (body == null) return null;
        JsonNode items = body.get("items");
        if (items == null) return null;
        return items.get("item");
    }

    /**
     * 입력 후보들(예: regionLabel, address)을 순서대로 시도하여 첫 매칭을 반환.
     * 모두 미스 시 empty.
     */
    public Optional<RegionCode> lookup(String... candidates) {
        if (candidates == null) return Optional.empty();
        for (String c : candidates) {
            if (c == null || c.isBlank()) continue;
            String key = normalize(c);
            RegionCode exact = exactByName.get(key);
            if (exact != null) return Optional.of(exact);
        }
        // 토큰 검색 — 첫 토큰(광역) + 마지막 토큰(시군구) 양쪽이 input 에 모두 등장하면 매칭.
        for (String c : candidates) {
            if (c == null || c.isBlank()) continue;
            String norm = normalize(c);
            for (Map.Entry<RegionTokenKey, RegionCode> entry : byTokens.entrySet()) {
                RegionTokenKey tk = entry.getKey();
                if (norm.contains(normalize(tk.regn())) && norm.contains(normalize(tk.sigg()))) {
                    return Optional.of(entry.getValue());
                }
            }
        }
        return Optional.empty();
    }

    private static String normalize(String s) {
        return s == null ? "" : s.replaceAll("\\s+", "").toLowerCase();
    }

    private static String textOrNull(JsonNode n) {
        if (n == null || n.isNull()) return null;
        String s = n.asText();
        return s == null || s.isBlank() ? null : s;
    }

    private record RegionTokenKey(String regn, String sigg) {
    }
}
