/**
 * guestCredits — fail-closed pattern tests
 *
 * Validates:
 *  - getGuestCreditStatus: returns canUse:false on RPC error
 *  - getGuestCreditStatus: returns correct status on success
 *  - useGuestCredit: returns success:false on RPC error
 *  - useGuestCredit: returns remaining credits on success
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies

// next/headers mock
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: vi.fn((name: string) => {
      if (name === "cf-connecting-ip") return "192.168.1.100";
      return null;
    }),
  })),
}));

// Logger mock
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

// Supabase admin client mock
const mockAdminRpc = vi.fn();
const mockAdminSelect = vi.fn();
const mockAdminEq = vi.fn();
const mockAdminSingle = vi.fn();
const mockAdminFrom = vi.fn(() => ({
  select: mockAdminSelect.mockReturnValue({
    eq: mockAdminEq.mockReturnValue({
      single: mockAdminSingle,
    }),
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    rpc: mockAdminRpc,
    from: mockAdminFrom,
  })),
}));

// Env vars
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

describe("getGuestCreditStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns canUse:false when RPC errors (fail-closed)", async () => {
    mockAdminRpc.mockResolvedValue({
      data: null,
      error: { message: "Connection timeout" },
    });

    const { getGuestCreditStatus } = await import("../guestCredits");
    const result = await getGuestCreditStatus();

    expect(result.canUse).toBe(false);
    expect(result.credits).toBe(0);
    expect(result.isGuest).toBe(true);
  });

  it("returns canUse:false when RPC throws (fail-closed)", async () => {
    mockAdminRpc.mockRejectedValue(new Error("Network error"));

    const { getGuestCreditStatus } = await import("../guestCredits");
    const result = await getGuestCreditStatus();

    expect(result.canUse).toBe(false);
    expect(result.credits).toBe(0);
  });

  it("returns correct credits when RPC succeeds", async () => {
    mockAdminRpc.mockResolvedValue({
      data: [{ current_credits: 2, can_use: true }],
      error: null,
    });
    mockAdminSingle.mockResolvedValue({
      data: { last_used_at: new Date().toISOString() },
    });

    const { getGuestCreditStatus } = await import("../guestCredits");
    const result = await getGuestCreditStatus();

    expect(result.credits).toBe(2);
    expect(result.canUse).toBe(true);
    expect(result.isGuest).toBe(true);
  });

  it("returns credits:0 when RPC data is empty", async () => {
    mockAdminRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const { getGuestCreditStatus } = await import("../guestCredits");
    const result = await getGuestCreditStatus();

    expect(result.credits).toBe(0);
    expect(result.canUse).toBe(false);
  });
});

describe("useGuestCredit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success:false when RPC errors (fail-closed)", async () => {
    mockAdminRpc.mockResolvedValue({
      data: null,
      error: { message: "Insert failed" },
    });

    const { useGuestCredit } = await import("../guestCredits");
    const result = await useGuestCredit();

    expect(result.success).toBe(false);
    expect(result.remainingCredits).toBe(0);
  });

  it("returns success:false when RPC throws (fail-closed)", async () => {
    mockAdminRpc.mockRejectedValue(new Error("DB unavailable"));

    const { useGuestCredit } = await import("../guestCredits");
    const result = await useGuestCredit();

    expect(result.success).toBe(false);
    expect(result.remainingCredits).toBe(0);
  });

  it("returns success:true with remaining credits on success", async () => {
    // First call: use_guest_credit RPC → true
    // Second call: replenish_guest_credits RPC (from getGuestCreditStatus) → credits info
    let callCount = 0;
    mockAdminRpc.mockImplementation(async (name: string) => {
      callCount++;
      if (name === "use_guest_credit") {
        return { data: true, error: null };
      }
      if (name === "replenish_guest_credits") {
        return {
          data: [{ current_credits: 1, can_use: true }],
          error: null,
        };
      }
      return { data: null, error: null };
    });
    mockAdminSingle.mockResolvedValue({
      data: { last_used_at: new Date().toISOString() },
    });

    const { useGuestCredit } = await import("../guestCredits");
    const result = await useGuestCredit();

    expect(result.success).toBe(true);
    expect(result.remainingCredits).toBe(1);
  });
});
