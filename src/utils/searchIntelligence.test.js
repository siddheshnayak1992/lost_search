import { describe, expect, it } from "vitest";
import vocabulary from "../data/controlledVocabulary.json";
import products from "../data/products.json";
import { createRecommendations, detectVocabularyGaps, groupQueries, levenshteinDistance, normalizeQuery, rankProducts, recordSearch, simulateFix, weightedJaccard } from "./searchIntelligence.js";

describe("search intelligence utilities", () => {
  it("normalizes controlled aliases and corrects spelling using edit distance", () => {
    expect(normalizeQuery("  COMFY   footwear ", vocabulary).normalized).toBe("comfortable shoes");
    expect(levenshteinDistance("cushoned", "cushioned")).toBe(1);
    expect(normalizeQuery("cushoned footwear", vocabulary).normalized).toBe("cushioned shoes");
    expect(normalizeQuery("water proof hiking shoe", vocabulary).normalized).toBe("waterproof hiking shoes");
    expect(normalizeQuery("light up party sneakers", vocabulary).normalized).toBe("light-up party sneakers");
  });

  it("ranks products with explainable field contributions", () => {
    const result = rankProducts("adiddas running shoes", products, vocabulary)[0];
    expect(result.product.brand).toBe("Adidas");
    expect(result.score).toBeGreaterThan(0);
    expect(result.explanation.some((entry) => entry.field === "brand")).toBe(true);
  });

  it("increments the count for a repeated normalized search", () => {
    const existing = [{ id: "SQ1", query: "blue running shoes", searchCount: 3, resultCount: 0 }];
    const updated = recordSearch(existing, " BLUE   RUNNING shoes ", 2);
    expect(updated).toHaveLength(1);
    expect(updated[0].searchCount).toBe(4);
    expect(updated[0].resultCount).toBe(2);
  });

  it("uses weighted Jaccard query overlap and sums grouped volume", () => {
    expect(weightedJaccard(["running", "shoe"], ["running", "trail"])).toBeCloseTo(1 / 3);
    const group = groupQueries([
      { query: "running shoes", searchCount: 4, resultCount: 0 },
      { query: "running shoe", searchCount: 2, resultCount: 1 }
    ], vocabulary, 0.2).find((item) => item.members.length === 2);
    expect(group.totalSearches).toBe(6);
    expect(group.representative).toBe("running shoes");
  });

  it("keeps simulator changes temporary and returns before/after rankings", () => {
    const result = simulateFix("glow footwear", "party", products, vocabulary);
    expect(result.before).toEqual([]);
    expect(result.rewrittenQuery).toBe("glow footwear party");
    expect(result.after.length).toBeGreaterThan(0);
  });

  it("detects a vocabulary gap only when a catalog candidate is recovered", () => {
    const recovered = rankProducts("red party footwear", products, vocabulary);
    expect(detectVocabularyGaps("red party footwear", recovered, vocabulary)[0].term).toBe("red");
    expect(detectVocabularyGaps("red party footwear", [], vocabulary)).toEqual([]);
  });

  it("generates an assortment review when no catalog term matches", () => {
    const items = createRecommendations([{ id: "x", query: "glow footwear", searchCount: 8, resultCount: 0 }], products, vocabulary);
    expect(items[0].type).toBe("REVIEW_ASSORTMENT_GAP");
  });
});