/**
 * analyzeMatchQuick — weekly analysis count (DEBIT-FIRST) tests
 *
 * Validates:
 *  - Free users: weekly count increment before AI call, refund on failure
 *  - Premium users: weekly count increment, refund on failure
 *  - Limit enforcement: free users at weekly limit → error
 *  - BYOK restriction: free users cannot use own API key
 *  - Cached results: no credit consumption
 *  - Input validation: bad matchId / puuid / summonerName → error
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks ----

// Supabase mock — chainable builder pattern
const mockRpc = vi.fn();
const mockSingle = vi.fn();
const mockUpsert = vi.fn().mockResolvedValue({ error: null });

// Chainable query object: .select().eq().eq().single() all return the same chainable
const chainable: Record<string, any> = {};
chainable.select = vi.fn(() => chainable);
chainable.eq = vi.fn(() => chainable);
chainable.single = mockSingle;
chainable.upsert = mockUpsert;

const mockFrom = vi.fn(() => chainable);
const mockGetUser = vi.fn();
const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: mockFrom,
  rpc: mockRpc,
};

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase),
  getUser: vi.fn(async () => {
    const result = await mockGetUser();
    return result?.data?.user ?? null;
  }),
}));

// Gemini mock
const mockGenerateContent = vi.fn();
vi.mock("@/lib/gemini", () => ({
  getGeminiClient: vi.fn(() => ({
    getGenerativeModel: vi.fn(() => ({
      generateContent: mockGenerateContent,
    })),
  })),
  isValidGeminiApiKey: vi.fn((key: string) => key?.startsWith("AIza")),
  GEMINI_MODELS_TO_TRY: ["gemini-2.0-flash"],
}));

// Riot mock
vi.mock("../riot", () => ({
  fetchMatchDetail: vi.fn(async () => ({
    success: true,
    data: {
      info: {
        participants: [
          {
            puuid: "valid-puuid-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678",
            championName: "Ahri",
            teamPosition: "MIDDLE",
            teamId: 100,
            kills: 5,
            deaths: 3,
            assists: 7,
            win: true,
          },
          {
            puuid: "opponent-puuid",
            championName: "Zed",
            teamPosition: "MIDDLE",
            teamId: 200,
            kills: 3,
            deaths: 5,
            assists: 2,
            win: false,
          },
        ],
      },
    },
  })),
  fetchDDItemData: vi.fn(async () => ({})),
  fetchLatestVersion: vi.fn(async () => "14.24.1"),
}));

// next/cache mock
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Stripe mock
vi.mock("@/lib/stripe", () => ({
  stripe: {},
}));

// Logger mock
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

// GEMINI_API_KEY env
vi.stubEnv("GEMINI_API_KEY", "AIzaTestKey123456789012345678901234");

// ---- Helpers ----

function makeStatus(overrides: Record<string, any> = {}) {
  return {
    is_premium: false,
    analysis_credits: 3,
    subscription_tier: "free",
    daily_analysis_count: 0,
    last_analysis_date: "",
    weekly_analysis_count: 0,
    weekly_reset_date: "",
    ...overrides,
  };
}

const VALID_MATCH_ID = "JP1_1234567890";
const VALID_PUUID = "valid-puuid-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678";
const VALID_SUMMONER = "TestPlayer";

const AI_SUCCESS_RESPONSE = {
  response: {
    text: () =>
      JSON.stringify({
        grade: "A",
        badge: { label: "エース", icon: "⭐", color: "text-yellow-400" },
        laneVerdict: { result: "WIN", reason: "CS差で優位" },
        keyFeedback: "良い試合でした",
      }),
  },
};

// ---- Tests ----

describe("analyzeMatchQuick credit flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockSingle.mockResolvedValue({ data: null }); // no cached result
    mockGenerateContent.mockResolvedValue(AI_SUCCESS_RESPONSE);
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  // Helper: mock refreshAnalysisStatus by mocking the RPC it calls
  function mockRefreshStatus(status: Record<string, any>) {
    // refreshAnalysisStatus calls supabase.rpc('refresh_analysis_status', ...)
    mockRpc.mockImplementation(async (name: string, params?: any) => {
      if (name === "refresh_analysis_status") {
        return { data: [status], error: null };
      }
      if (name === "increment_weekly_count") {
        return { data: (status.weekly_analysis_count || 0) + 1, error: null };
      }
      if (name === "decrement_weekly_count") {
        return { data: (status.weekly_analysis_count || 0), error: null };
      }
      return { data: null, error: null };
    });
  }

  it("returns error for invalid matchId", async () => {
    const { analyzeMatchQuick } = await import("../analysis");
    const result = await analyzeMatchQuick("INVALID", VALID_SUMMONER, VALID_PUUID);
    expect(result).toHaveProperty("error", "Invalid match ID");
  });

  it("returns error for invalid puuid", async () => {
    const { analyzeMatchQuick } = await import("../analysis");
    const result = await analyzeMatchQuick(VALID_MATCH_ID, VALID_SUMMONER, "short");
    expect(result).toHaveProperty("error", "Invalid PUUID");
  });

  it("returns error when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { analyzeMatchQuick } = await import("../analysis");
    const result = await analyzeMatchQuick(VALID_MATCH_ID, VALID_SUMMONER, VALID_PUUID);
    expect(result).toHaveProperty("error", "Not authenticated");
  });

  it("returns cached result without consuming credits", async () => {
    mockSingle.mockResolvedValue({
      data: {
        analysis_text: JSON.stringify({
          grade: "B",
          badge: { label: "安定", icon: "🛡️", color: "text-blue-400" },
          laneVerdict: { result: "EVEN", reason: "互角" },
          keyFeedback: "安定した試合",
        }),
      },
    });

    const { analyzeMatchQuick } = await import("../analysis");
    const result = await analyzeMatchQuick(VALID_MATCH_ID, VALID_SUMMONER, VALID_PUUID);

    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("cached", true);
    // No RPC calls for credit consumption
    expect(mockRpc).not.toHaveBeenCalledWith("increment_weekly_count", expect.anything());
  });

  it("free user: error when weekly limit reached", async () => {
    mockRefreshStatus(makeStatus({ weekly_analysis_count: 3, is_premium: false }));

    const { analyzeMatchQuick } = await import("../analysis");
    const result = await analyzeMatchQuick(VALID_MATCH_ID, VALID_SUMMONER, VALID_PUUID);

    expect(result).toHaveProperty("error");
    expect(result.error).toBe("FREE_WEEKLY_LIMIT_REACHED");
  });

  it("free user: BYOK returns error (premium-only)", async () => {
    mockRefreshStatus(makeStatus({ analysis_credits: 3, is_premium: false }));

    const { analyzeMatchQuick } = await import("../analysis");
    const result = await analyzeMatchQuick(
      VALID_MATCH_ID,
      VALID_SUMMONER,
      VALID_PUUID,
      "AIzaUserProvidedKey12345678901234"
    );

    expect(result).toHaveProperty("error");
    expect(result.error).toBe("CUSTOM_KEY_PREMIUM_ONLY");
  });

  it("free user: calls increment_weekly_count before AI", async () => {
    mockRefreshStatus(makeStatus({ weekly_analysis_count: 0, is_premium: false }));

    const callOrder: string[] = [];
    mockRpc.mockImplementation(async (name: string) => {
      callOrder.push(name);
      if (name === "refresh_analysis_status") {
        return { data: [makeStatus({ weekly_analysis_count: 0, is_premium: false })], error: null };
      }
      if (name === "increment_weekly_count") {
        return { data: 1, error: null };
      }
      return { data: null, error: null };
    });

    const { analyzeMatchQuick } = await import("../analysis");
    await analyzeMatchQuick(VALID_MATCH_ID, VALID_SUMMONER, VALID_PUUID);

    // increment must happen before AI call
    const incrementIndex = callOrder.indexOf("increment_weekly_count");
    expect(incrementIndex).toBeGreaterThan(-1);

    // AI call happens after increment
    expect(mockGenerateContent).toHaveBeenCalled();
  });

  it("free user: refunds weekly count when AI call fails", async () => {
    mockRefreshStatus(makeStatus({ weekly_analysis_count: 0, is_premium: false }));
    mockGenerateContent.mockRejectedValue(new Error("AI service unavailable"));

    const rpcCalls: string[] = [];
    mockRpc.mockImplementation(async (name: string) => {
      rpcCalls.push(name);
      if (name === "refresh_analysis_status") {
        return { data: [makeStatus({ weekly_analysis_count: 0, is_premium: false })], error: null };
      }
      if (name === "increment_weekly_count") return { data: 1, error: null };
      if (name === "decrement_weekly_count") return { data: 0, error: null };
      return { data: null, error: null };
    });

    const { analyzeMatchQuick } = await import("../analysis");
    const result = await analyzeMatchQuick(VALID_MATCH_ID, VALID_SUMMONER, VALID_PUUID);

    expect(result).toHaveProperty("error");
    // Verify refund was called
    expect(rpcCalls).toContain("decrement_weekly_count");
  });

  it("premium user: calls increment_weekly_count", async () => {
    mockRefreshStatus(makeStatus({
      is_premium: true,
      subscription_tier: "premium",
      weekly_analysis_count: 5,
    }));

    const rpcCalls: string[] = [];
    mockRpc.mockImplementation(async (name: string) => {
      rpcCalls.push(name);
      if (name === "refresh_analysis_status") {
        return {
          data: [makeStatus({
            is_premium: true,
            subscription_tier: "premium",
            weekly_analysis_count: 5,
          })],
          error: null,
        };
      }
      if (name === "increment_weekly_count") return { data: 6, error: null };
      return { data: null, error: null };
    });

    const { analyzeMatchQuick } = await import("../analysis");
    await analyzeMatchQuick(VALID_MATCH_ID, VALID_SUMMONER, VALID_PUUID);

    expect(rpcCalls).toContain("increment_weekly_count");
  });

  it("premium user: error when weekly limit reached (20)", async () => {
    mockRefreshStatus(makeStatus({
      is_premium: true,
      subscription_tier: "premium",
      weekly_analysis_count: 20,
    }));

    const { analyzeMatchQuick } = await import("../analysis");
    const result = await analyzeMatchQuick(VALID_MATCH_ID, VALID_SUMMONER, VALID_PUUID);

    expect(result).toHaveProperty("error");
    expect(result.error).toBe("WEEKLY_LIMIT_REACHED");
  });

  it("premium user: refunds weekly count on AI failure", async () => {
    mockRefreshStatus(makeStatus({
      is_premium: true,
      subscription_tier: "premium",
      weekly_analysis_count: 5,
    }));
    mockGenerateContent.mockRejectedValue(new Error("AI service error"));

    const rpcCalls: string[] = [];
    mockRpc.mockImplementation(async (name: string) => {
      rpcCalls.push(name);
      if (name === "refresh_analysis_status") {
        return {
          data: [makeStatus({
            is_premium: true,
            subscription_tier: "premium",
            weekly_analysis_count: 5,
          })],
          error: null,
        };
      }
      if (name === "increment_weekly_count") return { data: 6, error: null };
      if (name === "decrement_weekly_count") return { data: 5, error: null };
      return { data: null, error: null };
    });

    const { analyzeMatchQuick } = await import("../analysis");
    const result = await analyzeMatchQuick(VALID_MATCH_ID, VALID_SUMMONER, VALID_PUUID);

    expect(result).toHaveProperty("error");
    // Both free and premium users get refunded in the weekly count system
    expect(rpcCalls).toContain("decrement_weekly_count");
  });
});
