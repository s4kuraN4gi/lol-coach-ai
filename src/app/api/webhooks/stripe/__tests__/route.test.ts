/**
 * Stripe Webhook Handler Tests
 *
 * Tests for POST /api/webhooks/stripe
 * Covers: signature verification, idempotency, checkout.session.completed,
 *         subscription.updated, subscription.deleted, invoice.payment_failed,
 *         subscription.trial_will_end
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks ----

// Supabase chainable query builder
const mockSupaSingle = vi.fn();
const mockSupaSelect = vi.fn();
const mockSupaUpdate = vi.fn();
const mockSupaEq = vi.fn();

function createChainable() {
  const chain: Record<string, any> = {};
  chain.select = mockSupaSelect.mockReturnValue(chain);
  chain.eq = mockSupaEq.mockReturnValue(chain);
  chain.single = mockSupaSingle;
  chain.update = mockSupaUpdate.mockReturnValue(chain);
  return chain;
}

const chainable = createChainable();
const mockFrom = vi.fn(() => chainable);
const mockRpc = vi.fn();
const mockGetUserById = vi.fn();

const mockServiceSupabase = {
  from: mockFrom,
  rpc: mockRpc,
  auth: {
    admin: { getUserById: mockGetUserById },
  },
};

vi.mock("@/utils/supabase/server", () => ({
  createServiceRoleClient: vi.fn(() => mockServiceSupabase),
}));

// Stripe mock
const mockConstructEvent = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockSubscriptionsCancel = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: {
      retrieve: mockSubscriptionsRetrieve,
      cancel: mockSubscriptionsCancel,
    },
  },
}));

// Logger mock
const mockLoggerError = vi.fn();
const mockLoggerWarn = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: { error: mockLoggerError, warn: mockLoggerWarn },
}));

// next/headers mock
const mockHeadersGet = vi.fn();
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: mockHeadersGet,
  })),
}));

// Resend mock — must use a class (not arrow fn) because handler calls `new Resend()`
const mockEmailsSend = vi.fn();
vi.mock("resend", () => {
  return {
    Resend: class MockResend {
      emails = { send: mockEmailsSend };
    },
  };
});

// ---- Env ----
vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_secret");
vi.stubEnv("NEXT_PUBLIC_STRIPE_EXTRA_PRICE_ID", "price_extra_monthly");
vi.stubEnv("NEXT_PUBLIC_STRIPE_EXTRA_ANNUAL_PRICE_ID", "price_extra_annual");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");

// ---- Helpers ----

function makeRequest(body = "raw-body") {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body,
    headers: { "Stripe-Signature": "sig_test" },
  });
}

function makeEvent(type: string, dataObject: Record<string, any>, id = "evt_test_123") {
  return { id, type, data: { object: dataObject } };
}

function makeSubscription(overrides: Record<string, any> = {}) {
  return {
    id: "sub_123",
    customer: "cus_123",
    status: "active",
    cancel_at_period_end: false,
    items: {
      data: [
        {
          price: { id: "price_premium_monthly" },
          current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
        },
      ],
    },
    trial_end: null,
    ...overrides,
  };
}

function makeCheckoutSession(overrides: Record<string, any> = {}) {
  return {
    subscription: "sub_123",
    client_reference_id: "user-123",
    customer: "cus_123",
    metadata: {},
    ...overrides,
  };
}

async function callPOST(body = "raw-body") {
  const { POST } = await import("../route");
  return POST(makeRequest(body));
}

// ---- Tests ----

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeadersGet.mockReturnValue("sig_test");
    mockRpc.mockResolvedValue({ data: true, error: null });
    // Default: profile exists
    mockSupaSingle.mockResolvedValue({ data: { id: "user-123" }, error: null });
    mockSupaUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [{ id: "user-123" }], error: null }),
      }),
    });
  });

  // ========================================
  // Signature verification & idempotency
  // ========================================
  describe("署名検証 & 冪等性", () => {
    it("STRIPE_WEBHOOK_SECRET未設定 → 500", async () => {
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
      const response = await callPOST();
      expect(response.status).toBe(500);
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_secret");
    });

    it("署名検証失敗 → 400", async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const response = await callPOST();
      expect(response.status).toBe(400);
    });

    it("claim_webhook_event RPC失敗 → 500", async () => {
      const event = makeEvent("checkout.session.completed", makeCheckoutSession());
      mockConstructEvent.mockReturnValue(event);
      mockRpc.mockResolvedValue({ data: null, error: { message: "DB error" } });

      const response = await callPOST();
      expect(response.status).toBe(500);
    });

    it("重複イベント(claimed=false) → 200スキップ", async () => {
      const event = makeEvent("checkout.session.completed", makeCheckoutSession());
      mockConstructEvent.mockReturnValue(event);
      mockRpc.mockResolvedValue({ data: false, error: null });

      const response = await callPOST();
      expect(response.status).toBe(200);
      // Should NOT process the event (no from() calls after idempotency check)
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("未知のイベントタイプ → 200(no-op)", async () => {
      const event = makeEvent("unknown.event.type", {});
      mockConstructEvent.mockReturnValue(event);

      const response = await callPOST();
      expect(response.status).toBe(200);
    });
  });

  // ========================================
  // checkout.session.completed
  // ========================================
  describe("checkout.session.completed", () => {
    beforeEach(() => {
      mockSubscriptionsRetrieve.mockResolvedValue(makeSubscription());
    });

    it("subscriptionなし → スキップ", async () => {
      const event = makeEvent("checkout.session.completed", makeCheckoutSession({ subscription: null }));
      mockConstructEvent.mockReturnValue(event);

      const response = await callPOST();
      expect(response.status).toBe(200);
      expect(mockSubscriptionsRetrieve).not.toHaveBeenCalled();
    });

    it("client_reference_idなし → スキップ", async () => {
      const event = makeEvent("checkout.session.completed", makeCheckoutSession({ client_reference_id: null }));
      mockConstructEvent.mockReturnValue(event);

      const response = await callPOST();
      expect(response.status).toBe(200);
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("Missing userId")
      );
    });

    it("profilesにユーザーなし → スキップ", async () => {
      const event = makeEvent("checkout.session.completed", makeCheckoutSession());
      mockConstructEvent.mockReturnValue(event);
      mockSupaSingle.mockResolvedValue({ data: null, error: { message: "Not found" } });

      const response = await callPOST();
      expect(response.status).toBe(200);
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("User not found")
      );
    });

    it("Premium tier判定(非Extra price ID)", async () => {
      const sub = makeSubscription({
        items: { data: [{ price: { id: "price_premium_monthly" }, current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30 }] },
      });
      mockSubscriptionsRetrieve.mockResolvedValue(sub);

      const event = makeEvent("checkout.session.completed", makeCheckoutSession());
      mockConstructEvent.mockReturnValue(event);

      const response = await callPOST();
      expect(response.status).toBe(200);

      // Verify update was called with premium tier
      const updateCall = mockSupaUpdate.mock.calls[0]?.[0];
      expect(updateCall).toMatchObject({
        subscription_tier: "premium",
      });
    });

    it("Extra tier判定(EXTRA_PRICE_ID一致)", async () => {
      const sub = makeSubscription({
        items: { data: [{ price: { id: "price_extra_monthly" }, current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30 }] },
      });
      mockSubscriptionsRetrieve.mockResolvedValue(sub);

      const event = makeEvent("checkout.session.completed", makeCheckoutSession());
      mockConstructEvent.mockReturnValue(event);

      const response = await callPOST();
      expect(response.status).toBe(200);

      const updateCall = mockSupaUpdate.mock.calls[0]?.[0];
      expect(updateCall).toMatchObject({
        subscription_tier: "extra",
      });
    });

    it("Extra tier判定(EXTRA_ANNUAL_PRICE_ID一致)", async () => {
      const sub = makeSubscription({
        items: { data: [{ price: { id: "price_extra_annual" }, current_period_end: Math.floor(Date.now() / 1000) + 86400 * 365 }] },
      });
      mockSubscriptionsRetrieve.mockResolvedValue(sub);

      const event = makeEvent("checkout.session.completed", makeCheckoutSession());
      mockConstructEvent.mockReturnValue(event);

      const response = await callPOST();
      expect(response.status).toBe(200);

      const updateCall = mockSupaUpdate.mock.calls[0]?.[0];
      expect(updateCall).toMatchObject({
        subscription_tier: "extra",
      });
    });

    it("is_premium=true (status=active)", async () => {
      const sub = makeSubscription({ status: "active" });
      mockSubscriptionsRetrieve.mockResolvedValue(sub);

      const event = makeEvent("checkout.session.completed", makeCheckoutSession());
      mockConstructEvent.mockReturnValue(event);

      await callPOST();

      const updateCall = mockSupaUpdate.mock.calls[0]?.[0];
      expect(updateCall).toMatchObject({ is_premium: true });
    });

    it("is_premium=true (status=trialing)", async () => {
      const sub = makeSubscription({ status: "trialing" });
      mockSubscriptionsRetrieve.mockResolvedValue(sub);

      const event = makeEvent("checkout.session.completed", makeCheckoutSession());
      mockConstructEvent.mockReturnValue(event);

      await callPOST();

      const updateCall = mockSupaUpdate.mock.calls[0]?.[0];
      expect(updateCall).toMatchObject({ is_premium: true });
    });

    it("auto_renew=false (cancel_at_period_end=true)", async () => {
      const sub = makeSubscription({ cancel_at_period_end: true });
      mockSubscriptionsRetrieve.mockResolvedValue(sub);

      const event = makeEvent("checkout.session.completed", makeCheckoutSession());
      mockConstructEvent.mockReturnValue(event);

      await callPOST();

      const updateCall = mockSupaUpdate.mock.calls[0]?.[0];
      expect(updateCall).toMatchObject({ auto_renew: false });
    });

    it("subscription_end_date計算", async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 86400 * 30;
      const sub = makeSubscription({
        items: { data: [{ price: { id: "price_premium" }, current_period_end: periodEnd }] },
      });
      mockSubscriptionsRetrieve.mockResolvedValue(sub);

      const event = makeEvent("checkout.session.completed", makeCheckoutSession());
      mockConstructEvent.mockReturnValue(event);

      await callPOST();

      const updateCall = mockSupaUpdate.mock.calls[0]?.[0];
      expect(updateCall.subscription_end_date).toBe(
        new Date(periodEnd * 1000).toISOString()
      );
    });

    it("reward_referral RPC呼び出し(非致命的 — リトライ後もwebhook 200)", async () => {
      const event = makeEvent("checkout.session.completed", makeCheckoutSession());
      mockConstructEvent.mockReturnValue(event);
      // Make reward_referral fail on all attempts
      mockRpc.mockImplementation(async (name: string) => {
        if (name === "claim_webhook_event") return { data: true, error: null };
        if (name === "reward_referral") throw new Error("referral error");
        return { data: null, error: null };
      });

      const response = await callPOST();
      // Webhook should still succeed even if referral fails after retries
      expect(response.status).toBe(200);
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining("Referral reward attempt")
      );
    });

    it("旧subscription cancel(metadata.oldSubscriptionId)", async () => {
      const session = makeCheckoutSession({
        metadata: { oldSubscriptionId: "sub_old_999" },
      });
      const event = makeEvent("checkout.session.completed", session);
      mockConstructEvent.mockReturnValue(event);

      await callPOST();

      expect(mockSubscriptionsCancel).toHaveBeenCalledWith("sub_old_999");
    });

    it("旧subscription cancel — 同一IDの場合はキャンセルしない", async () => {
      const session = makeCheckoutSession({
        subscription: "sub_123",
        metadata: { oldSubscriptionId: "sub_123" },
      });
      const event = makeEvent("checkout.session.completed", session);
      mockConstructEvent.mockReturnValue(event);

      await callPOST();

      expect(mockSubscriptionsCancel).not.toHaveBeenCalled();
    });

    it("DB update失敗時のエラーログ", async () => {
      const event = makeEvent("checkout.session.completed", makeCheckoutSession());
      mockConstructEvent.mockReturnValue(event);
      mockSupaUpdate.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: null, error: { message: "RLS violation" } }),
        }),
      });

      const response = await callPOST();
      expect(response.status).toBe(200);
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("DB Update Failed")
      );
    });
  });

  // ========================================
  // customer.subscription.updated
  // ========================================
  describe("customer.subscription.updated", () => {
    it("profileなし → スキップ", async () => {
      const sub = makeSubscription();
      const event = makeEvent("customer.subscription.updated", sub);
      mockConstructEvent.mockReturnValue(event);
      mockSupaSingle.mockResolvedValue({ data: null, error: null });

      const response = await callPOST();
      expect(response.status).toBe(200);
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining("No profile found")
      );
    });

    it("tier/status正常更新", async () => {
      const sub = makeSubscription({ status: "active", cancel_at_period_end: false });
      const event = makeEvent("customer.subscription.updated", sub);
      mockConstructEvent.mockReturnValue(event);
      mockSupaSingle.mockResolvedValue({ data: { id: "user-123" }, error: null });
      mockSupaUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const response = await callPOST();
      expect(response.status).toBe(200);

      const updateCall = mockSupaUpdate.mock.calls[0]?.[0];
      expect(updateCall).toMatchObject({
        subscription_status: "active",
        is_premium: true,
        subscription_tier: "premium",
        auto_renew: true,
      });
    });

    it("Extra tier判定", async () => {
      const sub = makeSubscription({
        items: { data: [{ price: { id: "price_extra_monthly" }, current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30 }] },
      });
      const event = makeEvent("customer.subscription.updated", sub);
      mockConstructEvent.mockReturnValue(event);
      mockSupaSingle.mockResolvedValue({ data: { id: "user-123" }, error: null });
      mockSupaUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      await callPOST();

      const updateCall = mockSupaUpdate.mock.calls[0]?.[0];
      expect(updateCall).toMatchObject({ subscription_tier: "extra" });
    });
  });

  // ========================================
  // customer.subscription.deleted
  // ========================================
  describe("customer.subscription.deleted", () => {
    it("profileなし → スキップ", async () => {
      const sub = makeSubscription();
      const event = makeEvent("customer.subscription.deleted", sub);
      mockConstructEvent.mockReturnValue(event);
      mockSupaSingle.mockResolvedValue({ data: null, error: null });

      const response = await callPOST();
      expect(response.status).toBe(200);
      // Should not attempt to update
      expect(mockSupaUpdate).not.toHaveBeenCalled();
    });

    it("free tierリセット", async () => {
      const sub = makeSubscription();
      const event = makeEvent("customer.subscription.deleted", sub);
      mockConstructEvent.mockReturnValue(event);
      mockSupaSingle.mockResolvedValue({ data: { id: "user-123" }, error: null });
      mockSupaUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const response = await callPOST();
      expect(response.status).toBe(200);

      const updateCall = mockSupaUpdate.mock.calls[0]?.[0];
      expect(updateCall).toMatchObject({
        subscription_status: "canceled",
        is_premium: false,
        subscription_tier: "free",
        subscription_end_date: null,
        auto_renew: false,
      });
    });
  });

  // ========================================
  // invoice.payment_failed
  // ========================================
  describe("invoice.payment_failed", () => {
    it("customerIdなし → スキップ", async () => {
      const invoice = { customer: null };
      const event = makeEvent("invoice.payment_failed", invoice);
      mockConstructEvent.mockReturnValue(event);

      const response = await callPOST();
      expect(response.status).toBe(200);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("profileなし → スキップ", async () => {
      const invoice = { customer: "cus_123" };
      const event = makeEvent("invoice.payment_failed", invoice);
      mockConstructEvent.mockReturnValue(event);
      mockSupaSingle.mockResolvedValue({ data: null, error: null });

      const response = await callPOST();
      expect(response.status).toBe(200);
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining("No profile found")
      );
    });

    it("past_dueステータス設定", async () => {
      const invoice = { customer: "cus_123" };
      const event = makeEvent("invoice.payment_failed", invoice);
      mockConstructEvent.mockReturnValue(event);
      mockSupaSingle.mockResolvedValue({
        data: { id: "user-123", subscription_status: "active" },
        error: null,
      });
      mockSupaUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const response = await callPOST();
      expect(response.status).toBe(200);

      const updateCall = mockSupaUpdate.mock.calls[0]?.[0];
      expect(updateCall).toMatchObject({
        subscription_status: "past_due",
        auto_renew: false,
      });
    });
  });

  // ========================================
  // customer.subscription.trial_will_end
  // ========================================
  describe("customer.subscription.trial_will_end", () => {
    const trialSub = makeSubscription({
      customer: "cus_trial",
      trial_end: Math.floor(Date.now() / 1000) + 86400 * 3,
    });

    it("customerIdなし → スキップ", async () => {
      const sub = { ...trialSub, customer: null };
      const event = makeEvent("customer.subscription.trial_will_end", sub);
      mockConstructEvent.mockReturnValue(event);

      const response = await callPOST();
      expect(response.status).toBe(200);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("profileなし → スキップ", async () => {
      const event = makeEvent("customer.subscription.trial_will_end", trialSub);
      mockConstructEvent.mockReturnValue(event);
      mockSupaSingle.mockResolvedValue({ data: null, error: null });

      const response = await callPOST();
      expect(response.status).toBe(200);
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining("No profile found")
      );
    });

    it("メールアドレス取得不可 → スキップ", async () => {
      const event = makeEvent("customer.subscription.trial_will_end", trialSub);
      mockConstructEvent.mockReturnValue(event);
      mockSupaSingle.mockResolvedValue({
        data: { id: "user-123", summoner_name: "TestPlayer" },
        error: null,
      });
      mockGetUserById.mockResolvedValue({ data: null, error: { message: "Not found" } });

      const response = await callPOST();
      expect(response.status).toBe(200);
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining("Could not get email")
      );
      expect(mockEmailsSend).not.toHaveBeenCalled();
    });

    it("RESEND_API_KEY未設定 → スキップ", async () => {
      vi.stubEnv("RESEND_API_KEY", "");
      const event = makeEvent("customer.subscription.trial_will_end", trialSub);
      mockConstructEvent.mockReturnValue(event);
      mockSupaSingle.mockResolvedValue({
        data: { id: "user-123", summoner_name: "TestPlayer" },
        error: null,
      });
      mockGetUserById.mockResolvedValue({
        data: { user: { email: "test@example.com" } },
        error: null,
      });

      const response = await callPOST();
      expect(response.status).toBe(200);
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining("RESEND_API_KEY not configured")
      );
      expect(mockEmailsSend).not.toHaveBeenCalled();
    });

    it("メール送信成功", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      vi.stubEnv("EMAIL_FROM", "LoL Coach AI <noreply@lolcoachai.com>");
      const event = makeEvent("customer.subscription.trial_will_end", trialSub);
      mockConstructEvent.mockReturnValue(event);
      mockSupaSingle.mockResolvedValue({
        data: { id: "user-123", summoner_name: "TestPlayer" },
        error: null,
      });
      mockGetUserById.mockResolvedValue({
        data: { user: { email: "test@example.com" } },
        error: null,
      });
      mockEmailsSend.mockResolvedValue({ id: "email-123" });

      const response = await callPOST();
      expect(response.status).toBe(200);
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test@example.com",
          subject: expect.stringContaining("トライアル"),
        })
      );
    });

    it("メール送信失敗 → ログのみ、webhook 200", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      const event = makeEvent("customer.subscription.trial_will_end", trialSub);
      mockConstructEvent.mockReturnValue(event);
      mockSupaSingle.mockResolvedValue({
        data: { id: "user-123", summoner_name: "TestPlayer" },
        error: null,
      });
      mockGetUserById.mockResolvedValue({
        data: { user: { email: "test@example.com" } },
        error: null,
      });
      mockEmailsSend.mockRejectedValue(new Error("SMTP error"));

      const response = await callPOST();
      expect(response.status).toBe(200);
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("Trial reminder email send failed")
      );
    });
  });
});
