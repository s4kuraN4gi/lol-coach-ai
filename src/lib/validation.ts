import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

// ============================================================
// CSRF Protection — Origin header verification
// ============================================================

const ALLOWED_ORIGINS = [
  "https://lolcoachai.com",
  "https://www.lolcoachai.com",
];

if (process.env.NODE_ENV === "development") {
  ALLOWED_ORIGINS.push("http://localhost:3000");
}

/**
 * Verify the request Origin header matches allowed origins.
 * Returns null if valid, or a 403 NextResponse if invalid.
 */
export function verifyOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  if (!origin) {
    // Require Origin header for mutation endpoints (CSRF protection)
    return NextResponse.json({ error: "Missing Origin" }, { status: 403 });
  }
  if (ALLOWED_ORIGINS.includes(origin)) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ============================================================
// Common Validation Schemas
// ============================================================

/** Match ID: JP1_12345678, KR_12345678, NA1_12345678, etc. */
export const matchIdSchema = z.string().regex(
  /^[A-Z]{2,4}\d?_\d{5,15}$/,
  "Invalid match ID format"
);

/** PUUID: Riot's 78-char hex string */
export const puuidSchema = z.string().regex(
  /^[a-zA-Z0-9_-]{40,90}$/,
  "Invalid PUUID format"
);

/** Supported locales */
export const localeSchema = z.enum(["ja", "en", "ko"]).default("ja");

/** User chat message */
export const chatMessageSchema = z.string().min(1).max(2000);

/** Analysis focus text */
export const focusTextSchema = z.string().max(500).optional();

/** Base64 data URL for image frames */
const base64FrameSchema = z.string().max(2 * 1024 * 1024); // 2MB per frame

/** Frame array — max 10 to stay within 5MB bodySizeLimit (practical: ~200KB × 10 = 2MB) */
export const framesArraySchema = z.array(base64FrameSchema).max(10);

/** Structured frame object (for macro/guest analysis) */
export const structuredFrameSchema = z.object({
  segmentId: z.number().int().min(0).max(10),
  frameIndex: z.number().int().min(0).max(30),
  gameTime: z.number().min(0).max(7200),
  base64Data: z.string().max(2 * 1024 * 1024),
});
export const structuredFramesArraySchema = z.array(structuredFrameSchema).max(10);

/** Game time in seconds (0 to 2 hours) */
export const gameTimeSchema = z.number().min(0).max(7200).optional();

/** Stripe price ID */
export const priceIdSchema = z.string().min(1).max(100);

/** KDA string: e.g. "5/2/3" */
export const kdaSchema = z.string().regex(/^\d{1,3}\/\d{1,3}\/\d{1,3}$/, "Invalid KDA format");

/** Champion name */
export const championNameSchema = z.string().min(1).max(50);

/** Summoner name */
export const summonerNameSchema = z.string().min(1).max(50);

/** Job ID (UUID format) */
export const jobIdSchema = z.string().uuid("Invalid job ID format");

// ============================================================
// Composite Schemas for API Routes
// ============================================================

/** POST /api/chat */
export const chatRequestSchema = z.object({
  message: chatMessageSchema,
  context: z.object({
    rank: z.string().max(50).optional(),
    winRate: z.string().max(10).optional(),
    favoriteChampions: z.string().max(200).optional(),
    recentPerformance: z.string().max(200).optional(),
    summonerName: z.string().max(50).optional(),
    currentMatch: z.object({
      championName: championNameSchema,
      kda: z.string().max(20),
      win: z.boolean(),
      opponentChampion: z.string().max(50).optional(),
      matchId: z.string().max(30).optional(),
    }).optional(),
  }).optional(),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    text: z.string().max(5000),
  })).max(10).optional(),
});

/** POST /api/checkout */
export const checkoutRequestSchema = z.object({
  priceId: priceIdSchema,
});

/** Vision analysis request */
export const visionRequestSchema = z.object({
  frames: framesArraySchema,
  question: focusTextSchema,
  description: z.string().max(1000).optional(),
  matchId: matchIdSchema.optional(),
  puuid: puuidSchema.optional(),
  language: localeSchema,
  analysisStartGameTime: gameTimeSchema,
  analysisEndGameTime: gameTimeSchema,
});

/** Coach analysis focus */
export const analysisFocusSchema = z.object({
  focusArea: z.string().max(200).optional(),
  focusTime: z.string().max(50).optional(),
  specificQuestion: z.string().max(500).optional(),
  mode: z.string().max(20).optional(),
}).optional();

// ============================================================
// Helper: safe parse with error message
// ============================================================

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
  return { success: false, error: `Validation error: ${messages}` };
}
