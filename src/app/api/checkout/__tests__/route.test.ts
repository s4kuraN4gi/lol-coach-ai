/**
 * Checkout API Route Tests
 *
 * Tests for POST /api/checkout
 * Covers: request validation, customer lookup, same-plan detection,
 *         plan switching with proration, referral trial periods, session creation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---- Mocks ----

// Supabase chainable query builder
const mockSupaSingle = vi.fn();
const mockSupaSelect = vi.fn();
const mockSupaHead = vi.fn();

function createChainable() {
  const chain: Record<string, any> = {};
  chain.select = vi.fn((_cols?: string, _opts?: any) => {
    // Handle { count: 'exact', head: true } for referral queries
    if (_opts?.head) {
      return {
        eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
      };
    }
    chain._selectCalled = true;
    return chain;
  });
  chain.eq = vi.fn(() => chain);
  chain.single = mockSupaSingle;
  return chain;
}

const chainable = createChainable();
const mockFrom = vi.fn(() => createChainable());
const mockRpc = vi.fn();

const mockGetUserFn = vi.fn();
const mockSupabase = {
  from: mockFrom,
  rpc: mockRpc,
};

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase),
  getUser: vi.fn(async () => mockGetUserFn()),
}));

// Stripe mock
const mockCustomersList = vi.fn();
const mockSubscriptionsList = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockCouponsCreate = vi.fn();
const mockCheckoutSessionsCreate = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: { list: mockCustomersList },
    subscriptions: { list: mockSubscriptionsList, retrieve: mockSubscriptionsRetrieve },
    coupons: { create: mockCouponsCreate },
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
  },
}));

// Validation mock
const mockVerifyOrigin = vi.fn().mockReturnValue(null);
vi.mock("@/lib/validation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/validation")>();
  return {
    ...actual,
    verifyOrigin: (...args: any[]) => mockVerifyOrigin(...args),
  };
});

// Logger mock
const mockLoggerError = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: { error: mockLoggerError, warn: vi.fn() },
}));

// ---- Env ----
vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
vi.stubEnv("NEXT_PUBLIC_STRIPE_PRICE_ID", "price_premium_monthly");
vi.stubEnv("NEXT_PUBLIC_STRIPE_EXTRA_PRICE_ID", "price_extra_monthly");
vi.stubEnv("NEXT_PUBLIC_STRIPE_PREMIUM_ANNUAL_PRICE_ID", "price_premium_annual");
vi.stubEnv("NEXT_PUBLIC_STRIPE_EXTRA_ANNUAL_PRICE_ID", "price_extra_annual");
vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lolcoachai.com");

// ---- Helpers ----

function makeNextRequest(body: Record<string, any>) {
  return new NextRequest("http://localhost/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const TEST_USER = {
  id: "user-123",
  email: "test@example.com",
};

function setupProfileQuery(profile: Record<string, any> | null) {
  const singleFn = vi.fn().mockResolvedValue({
    data: profile,
    error: profile ? null : { message: "Not found" },
  });
  const eqFn = vi.fn().mockReturnValue({ single: singleFn });
  const selectFn = vi.fn((_cols?: string, _opts?: any) => {
    if (_opts?.head) {
      return { eq: vi.fn().mockResolvedValue({ count: 0, error: null }) };
    }
    return { eq: eqFn };
  });

  mockFrom.mockImplementation((table: string) => {
    if (table === "profiles") {
      return { select: selectFn, eq: eqFn, single: singleFn };
    }
    if (table === "referrals") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
        }),
      };
    }
    return createChainable();
  });
}

async function callPOST(body: Record<string, any>) {
  const { POST } = await import("../route");
  return POST(makeNextRequest(body));
}

// ---- Tests ----

describe("POST /api/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserFn.mockReturnValue(TEST_USER);
    mockVerifyOrigin.mockReturnValue(null);
    setupProfileQuery({ stripe_customer_id: null, stripe_subscription_id: null });
    mockCustomersList.mockResolvedValue({ data: [] });
    mockSubscriptionsList.mockResolvedValue({ data: [] });
    mockCheckoutSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session_123" });
  });

  // ========================================
  // Request validation
  // ========================================
  describe("リクエストバリデーション", () => {
    it("origin検証失敗 → 403", async () => {
      const { NextResponse } = await import("next/server");
      mockVerifyOrigin.mockReturnValue(
        NextResponse.json({ error: "Forbidden" }, { status: 403 })
      );

      const response = await callPOST({ priceId: "price_premium_monthly" });
      expect(response.status).toBe(403);
    });

    it("未認証 → 401", async () => {
      mockGetUserFn.mockReturnValue(null);

      const response = await callPOST({ priceId: "price_premium_monthly" });
      expect(response.status).toBe(401);
    });

    it("Zod検証失敗(priceId欠落) → 400", async () => {
      const response = await callPOST({});
      expect(response.status).toBe(400);
    });

    it("ホワイトリスト外priceId → 400", async () => {
      const response = await callPOST({ priceId: "price_malicious_id" });
      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toContain("Invalid Price ID");
    });
  });

  // ========================================
  // Customer lookup
  // ========================================
  describe("顧客検索", () => {
    it("DB上の既存stripe_customer_id使用", async () => {
      setupProfileQuery({
        stripe_customer_id: "cus_existing",
        stripe_subscription_id: null,
      });

      await callPOST({ priceId: "price_premium_monthly" });

      // Should NOT call customers.list since we found customerId in DB
      expect(mockCustomersList).not.toHaveBeenCalled();
      // Session should use existing customer ID
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ customer: "cus_existing" }),
        expect.anything()
      );
    });

    it("DBになければStripe API検索(email)", async () => {
      setupProfileQuery({ stripe_customer_id: null, stripe_subscription_id: null });
      mockCustomersList.mockResolvedValue({ data: [{ id: "cus_found_by_email" }] });

      await callPOST({ priceId: "price_premium_monthly" });

      expect(mockCustomersList).toHaveBeenCalledWith({
        email: "test@example.com",
        limit: 1,
      });
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ customer: "cus_found_by_email" }),
        expect.anything()
      );
    });

    it("既存subscription検出(DB → Stripe fallback)", async () => {
      setupProfileQuery({ stripe_customer_id: "cus_123", stripe_subscription_id: null });
      const activeSub = {
        id: "sub_found",
        status: "active",
        items: { data: [{ price: { id: "price_premium_monthly" } }] },
      };
      mockSubscriptionsList.mockResolvedValue({ data: [activeSub] });
      mockSubscriptionsRetrieve.mockResolvedValue({
        ...activeSub,
        cancel_at_period_end: false,
      });

      // Use a different price to avoid same-plan shortcut
      await callPOST({ priceId: "price_extra_monthly" });

      expect(mockSubscriptionsList).toHaveBeenCalledWith({
        customer: "cus_123",
        status: "active",
        limit: 5,
      });
    });
  });

  // ========================================
  // Same-plan detection
  // ========================================
  describe("同一プラン検出", () => {
    function setupExistingSub(priceId: string) {
      setupProfileQuery({
        stripe_customer_id: "cus_123",
        stripe_subscription_id: "sub_existing",
      });
      mockSubscriptionsRetrieve.mockResolvedValue({
        id: "sub_existing",
        status: "active",
        cancel_at_period_end: false,
        items: { data: [{ price: { id: priceId } }] },
      });
    }

    it("同じprice → sync_subscription_tier RPC → success URL返却", async () => {
      setupExistingSub("price_premium_monthly");
      mockRpc.mockResolvedValue({ error: null });

      const response = await callPOST({ priceId: "price_premium_monthly" });
      const json = await response.json();

      expect(json.url).toContain("checkout=success");
      expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
      expect(mockRpc).toHaveBeenCalledWith("sync_subscription_tier", {
        p_user_id: "user-123",
        p_tier: "premium",
      });
    });

    it("Extra price → tier='extra'でRPC", async () => {
      setupExistingSub("price_extra_monthly");
      mockRpc.mockResolvedValue({ error: null });

      const response = await callPOST({ priceId: "price_extra_monthly" });
      const json = await response.json();

      expect(json.url).toContain("checkout=success");
      expect(mockRpc).toHaveBeenCalledWith("sync_subscription_tier", {
        p_user_id: "user-123",
        p_tier: "extra",
      });
    });

    it("sync RPC失敗 → エラーログ出力、URLは返却", async () => {
      setupExistingSub("price_premium_monthly");
      mockRpc.mockResolvedValue({ error: { message: "RPC failed" } });

      const response = await callPOST({ priceId: "price_premium_monthly" });
      const json = await response.json();

      expect(json.url).toContain("checkout=success");
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("Tier sync failed")
      );
    });
  });

  // ========================================
  // Plan switching & proration
  // ========================================
  describe("プラン切替 & プロレーション", () => {
    const now = Math.floor(Date.now() / 1000);
    const periodStart = now - 86400 * 15; // 15 days ago
    const periodEnd = now + 86400 * 15;   // 15 days remaining
    const unitAmount = 980; // ¥980

    function setupPlanSwitch() {
      setupProfileQuery({
        stripe_customer_id: "cus_123",
        stripe_subscription_id: "sub_old",
      });
      mockSubscriptionsRetrieve.mockResolvedValue({
        id: "sub_old",
        status: "active",
        cancel_at_period_end: false,
        items: {
          data: [{
            price: { id: "price_premium_monthly", unit_amount: unitAmount, currency: "jpy" },
            current_period_start: periodStart,
            current_period_end: periodEnd,
          }],
        },
      });
      mockCouponsCreate.mockResolvedValue({ id: "coupon_test_123" });
    }

    it("残日数から割引額を正しく計算", async () => {
      setupPlanSwitch();

      await callPOST({ priceId: "price_extra_monthly" });

      expect(mockCouponsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: "jpy",
          duration: "once",
        }),
        expect.objectContaining({
          idempotencyKey: expect.stringContaining("coupon_user-123_sub_old"),
        })
      );

      // Verify amount_off is calculated correctly (proportional to remaining time)
      const couponArgs = mockCouponsCreate.mock.calls[0][0];
      expect(couponArgs.amount_off).toBeGreaterThan(0);
      expect(couponArgs.amount_off).toBeLessThanOrEqual(unitAmount);
    });

    it("Stripeクーポン作成(amount_off, currency, duration='once')", async () => {
      setupPlanSwitch();

      await callPOST({ priceId: "price_extra_monthly" });

      expect(mockCouponsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: "once",
          currency: "jpy",
        }),
        expect.anything()
      );

      // Verify the coupon is applied to the session
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          discounts: [{ coupon: "coupon_test_123" }],
        }),
        expect.anything()
      );
    });

    it("oldSubscriptionIdをメタデータに設定", async () => {
      setupPlanSwitch();

      await callPOST({ priceId: "price_extra_monthly" });

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            oldSubscriptionId: "sub_old",
          }),
        }),
        expect.anything()
      );
    });

    it("subscription retrieve失敗 → ログ出力、処理継続", async () => {
      setupProfileQuery({
        stripe_customer_id: "cus_123",
        stripe_subscription_id: "sub_broken",
      });
      mockSubscriptionsRetrieve.mockRejectedValue(new Error("Stripe API error"));

      const response = await callPOST({ priceId: "price_extra_monthly" });
      const json = await response.json();

      // Should still create a new session
      expect(json.url).toBe("https://checkout.stripe.com/session_123");
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("Existing subscription retrieval failed")
      );
    });
  });

  // ========================================
  // Referral trial period
  // ========================================
  describe("リファラル試用期間", () => {
    it("新規ユーザー(リファラルなし) → trial_period_days=7", async () => {
      setupProfileQuery({ stripe_customer_id: null, stripe_subscription_id: null });

      // No referral
      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          const singleFn = vi.fn().mockResolvedValue({
            data: { stripe_customer_id: null, stripe_subscription_id: null },
            error: null,
          });
          const eqFn = vi.fn().mockReturnValue({ single: singleFn });
          return {
            select: vi.fn().mockReturnValue({ eq: eqFn }),
          };
        }
        if (table === "referrals") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          };
        }
        return createChainable();
      });

      await callPOST({ priceId: "price_premium_monthly" });

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_data: { trial_period_days: 7 },
        }),
        expect.anything()
      );
    });

    it("新規ユーザー(リファラルあり) → trial_period_days=14", async () => {
      // Has referral
      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          const singleFn = vi.fn().mockResolvedValue({
            data: { stripe_customer_id: null, stripe_subscription_id: null },
            error: null,
          });
          const eqFn = vi.fn().mockReturnValue({ single: singleFn });
          return {
            select: vi.fn().mockReturnValue({ eq: eqFn }),
          };
        }
        if (table === "referrals") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
            }),
          };
        }
        return createChainable();
      });

      await callPOST({ priceId: "price_premium_monthly" });

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_data: { trial_period_days: 14 },
        }),
        expect.anything()
      );
    });

    it("既存ユーザー(プラン切替) → トライアルなし", async () => {
      setupProfileQuery({
        stripe_customer_id: "cus_123",
        stripe_subscription_id: "sub_old",
      });
      mockSubscriptionsRetrieve.mockResolvedValue({
        id: "sub_old",
        status: "active",
        cancel_at_period_end: false,
        items: {
          data: [{
            price: { id: "price_premium_monthly", unit_amount: 0, currency: "jpy" },
            current_period_start: Math.floor(Date.now() / 1000) - 86400,
            current_period_end: Math.floor(Date.now() / 1000) + 86400,
          }],
        },
      });

      await callPOST({ priceId: "price_extra_monthly" });

      // Should NOT have subscription_data with trial
      const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0];
      expect(sessionArgs.subscription_data).toBeUndefined();
    });
  });

  // ========================================
  // Session creation
  // ========================================
  describe("セッション作成", () => {
    it("line_items正常設定", async () => {
      await callPOST({ priceId: "price_premium_monthly" });

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: "price_premium_monthly", quantity: 1 }],
        }),
        expect.anything()
      );
    });

    it("customer ID使用", async () => {
      setupProfileQuery({ stripe_customer_id: "cus_known", stripe_subscription_id: null });

      await callPOST({ priceId: "price_premium_monthly" });

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_known",
          customer_email: undefined,
        }),
        expect.anything()
      );
    });

    it("customer_email fallback", async () => {
      setupProfileQuery({ stripe_customer_id: null, stripe_subscription_id: null });
      mockCustomersList.mockResolvedValue({ data: [] });

      await callPOST({ priceId: "price_premium_monthly" });

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: undefined,
          customer_email: "test@example.com",
        }),
        expect.anything()
      );
    });

    it("冪等性キー生成(user_id + price_id + time_bucket)", async () => {
      await callPOST({ priceId: "price_premium_monthly" });

      const idempotencyArg = mockCheckoutSessionsCreate.mock.calls[0]?.[1];
      expect(idempotencyArg).toHaveProperty("idempotencyKey");
      expect(idempotencyArg.idempotencyKey).toMatch(
        /^checkout_user-123_price_premium_monthly_\d+$/
      );
    });

    it("session.url返却", async () => {
      mockCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/pay/abc123",
      });

      const response = await callPOST({ priceId: "price_premium_monthly" });
      const json = await response.json();

      expect(json.url).toBe("https://checkout.stripe.com/pay/abc123");
    });
  });
});
