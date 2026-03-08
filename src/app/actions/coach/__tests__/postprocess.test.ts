import { describe, it, expect, vi, beforeEach } from "vitest";
import { postprocessAnalysisResult } from "../postprocess";
import type { RawAIAnalysisResult } from "../postprocess";
import type { BuildItem } from "../types";

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// Helpers
function makeItemMap(entries: [string, string][]): Record<string, string> {
  return Object.fromEntries(entries);
}

function makeEvent(timestamp: number) {
  return { timestamp, type: "CHAMPION_KILL" };
}

function makeInsight(timestamp: number, timestampStr: string) {
  return {
    timestamp,
    timestampStr,
    title: `Event at ${timestampStr}`,
    description: "Test insight",
    type: "MISTAKE" as const,
    advice: "Do better",
  };
}

function makeRecommendedItem(itemName: string) {
  return { itemName, reason: "good item" };
}

function makeValidAnalysisResult(overrides: Partial<RawAIAnalysisResult> = {}): RawAIAnalysisResult {
  return {
    insights: [makeInsight(60000, "1:00")],
    buildRecommendation: {
      recommendedItems: [makeRecommendedItem("Infinity Edge")],
      analysis: "Buy this item",
    },
    summaryAnalysis: { rootCause: "test", priorityFocus: "VISION_CONTROL", actionPlan: [] as string[], message: "msg" },
    turningPoint: { timestamp: 60000, timestampStr: "1:00", event: "kill", goldSwing: 300, description: "d", whatShouldHaveDone: "w" },
    homework: { title: "h", description: "d", howToCheck: "c", relatedTimestamps: [] as string[] },
    strengthWeakness: { strengths: [], weaknesses: [] },
    ...overrides,
  };
}

const userItems: BuildItem[] = [{ id: 3031, itemName: "Infinity Edge" }];
const opponentItems: BuildItem[] = [{ id: 3047, itemName: "Plated Steelcaps" }];
const opponentChampionName = "Garen";

describe("postprocessAnalysisResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("structure validation", () => {
    it("returns error when buildRecommendation is missing", () => {
      const result = postprocessAnalysisResult(
        { insights: [] },
        userItems,
        opponentItems,
        opponentChampionName,
        {},
        []
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("invalid response structure");
      }
    });

    it("returns error when recommendedItems is missing", () => {
      const result = postprocessAnalysisResult(
        { buildRecommendation: {}, insights: [] },
        userItems,
        opponentItems,
        opponentChampionName,
        {},
        []
      );
      expect(result.success).toBe(false);
    });

    it("treats missing insights as empty array (non-fatal)", () => {
      const analysisResult = {
        buildRecommendation: {
          recommendedItems: [makeRecommendedItem("Infinity Edge")],
          analysis: "test",
        },
      };
      const itemMap = makeItemMap([["infinity edge", "3031"]]);
      const events = [makeEvent(60000)];

      const result = postprocessAnalysisResult(
        analysisResult,
        userItems,
        opponentItems,
        opponentChampionName,
        itemMap,
        events
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.insights).toEqual([]);
      }
    });
  });

  describe("item name → ID mapping", () => {
    it("maps item names to IDs via itemMap (case-insensitive)", () => {
      const analysisResult = makeValidAnalysisResult({
        buildRecommendation: {
          recommendedItems: [makeRecommendedItem("Infinity Edge")],
          analysis: "test",
        },
      });
      const itemMap = makeItemMap([["infinity edge", "3031"]]);
      const events = [makeEvent(60000)];

      const result = postprocessAnalysisResult(
        analysisResult,
        userItems,
        opponentItems,
        opponentChampionName,
        itemMap,
        events
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.buildRecommendation!.recommendedItems[0].id).toBe(3031);
      }
    });

    it("normalizes whitespace and special characters in item names", () => {
      const analysisResult = makeValidAnalysisResult({
        buildRecommendation: {
          recommendedItems: [makeRecommendedItem("Blade of\u3000the\tRuined King")],
          analysis: "test",
        },
      });
      // itemMap key has regular spaces
      const itemMap = makeItemMap([["bladeoftheruinedking", "3153"]]);
      const events = [makeEvent(60000)];

      const result = postprocessAnalysisResult(
        analysisResult,
        userItems,
        opponentItems,
        opponentChampionName,
        itemMap,
        events
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.buildRecommendation!.recommendedItems[0].id).toBe(3153);
      }
    });

    it("filters out unknown items (id=0) with warning", async () => {
      const { logger } = await import("@/lib/logger");
      const analysisResult = makeValidAnalysisResult({
        buildRecommendation: {
          recommendedItems: [
            makeRecommendedItem("Infinity Edge"),
            makeRecommendedItem("Hallucinated Item"),
          ],
          analysis: "test",
        },
      });
      const itemMap = makeItemMap([["infinity edge", "3031"]]);
      const events = [makeEvent(60000)];

      const result = postprocessAnalysisResult(
        analysisResult,
        userItems,
        opponentItems,
        opponentChampionName,
        itemMap,
        events
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.buildRecommendation!.recommendedItems).toHaveLength(1);
        expect(result.data.buildRecommendation!.recommendedItems[0].itemName).toBe("Infinity Edge");
      }
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Hallucinated Item")
      );
    });

    it("maps multiple items correctly", () => {
      const analysisResult = makeValidAnalysisResult({
        buildRecommendation: {
          recommendedItems: [
            makeRecommendedItem("Infinity Edge"),
            makeRecommendedItem("Phantom Dancer"),
            makeRecommendedItem("Bloodthirster"),
          ],
          analysis: "test",
        },
      });
      const itemMap = makeItemMap([
        ["infinity edge", "3031"],
        ["phantom dancer", "3046"],
        ["bloodthirster", "3072"],
      ]);
      const events = [makeEvent(60000)];

      const result = postprocessAnalysisResult(
        analysisResult,
        userItems,
        opponentItems,
        opponentChampionName,
        itemMap,
        events
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const ids = result.data.buildRecommendation!.recommendedItems.map((i) => i.id);
        expect(ids).toEqual([3031, 3046, 3072]);
      }
    });
  });

  describe("insight timestamp cross-check (±60s tolerance)", () => {
    it("keeps insights with matching truth events within 60s", () => {
      const analysisResult = makeValidAnalysisResult({
        insights: [makeInsight(120000, "2:00")],
        buildRecommendation: {
          recommendedItems: [],
          analysis: "test",
        },
      });
      const events = [makeEvent(150000)]; // 30s apart — within tolerance

      const result = postprocessAnalysisResult(
        analysisResult,
        userItems,
        opponentItems,
        opponentChampionName,
        {},
        events
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.insights).toHaveLength(1);
      }
    });

    it("filters insights with no matching truth event (>60s)", async () => {
      const { logger } = await import("@/lib/logger");
      const analysisResult = makeValidAnalysisResult({
        insights: [makeInsight(120000, "2:00")],
        buildRecommendation: {
          recommendedItems: [],
          analysis: "test",
        },
      });
      const events = [makeEvent(300000)]; // 180s apart — outside tolerance

      const result = postprocessAnalysisResult(
        analysisResult,
        userItems,
        opponentItems,
        opponentChampionName,
        {},
        events
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.insights).toHaveLength(0);
      }
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("No matching Truth Event")
      );
    });

    it("keeps insight when event is exactly 59999ms away", () => {
      const analysisResult = makeValidAnalysisResult({
        insights: [makeInsight(100000, "1:40")],
        buildRecommendation: { recommendedItems: [], analysis: "test" },
      });
      const events = [makeEvent(159999)]; // 59999ms — within tolerance

      const result = postprocessAnalysisResult(
        analysisResult,
        userItems,
        opponentItems,
        opponentChampionName,
        {},
        events
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.insights).toHaveLength(1);
      }
    });

    it("filters insight when event is exactly 60000ms away", () => {
      const analysisResult = makeValidAnalysisResult({
        insights: [makeInsight(100000, "1:40")],
        buildRecommendation: { recommendedItems: [], analysis: "test" },
      });
      const events = [makeEvent(160000)]; // 60000ms — at boundary, filtered

      const result = postprocessAnalysisResult(
        analysisResult,
        userItems,
        opponentItems,
        opponentChampionName,
        {},
        events
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.insights).toHaveLength(0);
      }
    });

    it("handles multiple insights, keeping only valid ones", () => {
      const analysisResult = makeValidAnalysisResult({
        insights: [
          makeInsight(60000, "1:00"),  // matches event at 90000 (30s)
          makeInsight(200000, "3:20"), // no match
          makeInsight(300000, "5:00"), // matches event at 310000 (10s)
        ],
        buildRecommendation: { recommendedItems: [], analysis: "test" },
      });
      const events = [makeEvent(90000), makeEvent(310000)];

      const result = postprocessAnalysisResult(
        analysisResult,
        userItems,
        opponentItems,
        opponentChampionName,
        {},
        events
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.insights).toHaveLength(2);
        expect(result.data.insights[0].timestampStr).toBe("1:00");
        expect(result.data.insights[1].timestampStr).toBe("5:00");
      }
    });
  });

  describe("output structure", () => {
    it("includes userItems, opponentItems, and opponentChampionName in result", () => {
      const analysisResult = makeValidAnalysisResult({
        buildRecommendation: {
          recommendedItems: [makeRecommendedItem("Infinity Edge")],
          analysis: "Great build",
        },
      });
      const itemMap = makeItemMap([["infinity edge", "3031"]]);
      const events = [makeEvent(60000)];

      const result = postprocessAnalysisResult(
        analysisResult,
        userItems,
        opponentItems,
        opponentChampionName,
        itemMap,
        events
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.buildRecommendation!.userItems).toEqual(userItems);
        expect(result.data.buildRecommendation!.opponentItems).toEqual(opponentItems);
        expect(result.data.buildRecommendation!.opponentChampionName).toBe("Garen");
        expect(result.data.buildRecommendation!.analysis).toBe("Great build");
      }
    });

    it("passes through summaryAnalysis, turningPoint, homework, strengthWeakness", () => {
      const summaryAnalysis = { rootCause: "deaths", priorityFocus: "REDUCE_DEATHS" as const, actionPlan: ["a"], message: "m" };
      const turningPoint = { timestamp: 60000, timestampStr: "1:00", event: "Baron", goldSwing: 3000, description: "d", whatShouldHaveDone: "w" };
      const homework = { title: "Farming", description: "Improve CS", howToCheck: "Check CS/min", relatedTimestamps: ["5:00"] };
      const strengthWeakness = { strengths: [{ category: "CS", value: "8.5", comparison: "above avg" }], weaknesses: [] };

      const analysisResult = makeValidAnalysisResult({
        buildRecommendation: { recommendedItems: [], analysis: "test" },
        summaryAnalysis,
        turningPoint,
        homework,
        strengthWeakness,
      });

      const result = postprocessAnalysisResult(
        analysisResult,
        userItems,
        opponentItems,
        opponentChampionName,
        {},
        [makeEvent(60000)]
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.summaryAnalysis).toEqual(summaryAnalysis);
        expect(result.data.turningPoint).toEqual(turningPoint);
        expect(result.data.homework).toEqual(homework);
        expect(result.data.strengthWeakness).toEqual(strengthWeakness);
      }
    });
  });
});
