import { describe, it, expect } from "vitest";
import {
  matchIdSchema,
  puuidSchema,
  localeSchema,
  kdaSchema,
  championNameSchema,
  summonerNameSchema,
  jobIdSchema,
  framesArraySchema,
  priceIdSchema,
  validateInput,
} from "../validation";

describe("matchIdSchema", () => {
  it("accepts valid JP match ID", () => {
    expect(matchIdSchema.safeParse("JP1_1234567890").success).toBe(true);
  });

  it("accepts valid KR match ID", () => {
    expect(matchIdSchema.safeParse("KR_1234567890").success).toBe(true);
  });

  it("accepts valid NA1 match ID", () => {
    expect(matchIdSchema.safeParse("NA1_1234567890").success).toBe(true);
  });

  it("accepts valid EUW1 match ID", () => {
    expect(matchIdSchema.safeParse("EUW1_1234567890").success).toBe(true);
  });

  it("rejects empty string", () => {
    expect(matchIdSchema.safeParse("").success).toBe(false);
  });

  it("rejects match ID without region prefix", () => {
    expect(matchIdSchema.safeParse("1234567890").success).toBe(false);
  });

  it("rejects match ID with special characters", () => {
    expect(matchIdSchema.safeParse("JP1_123<script>").success).toBe(false);
  });
});

describe("puuidSchema", () => {
  const validPuuid = "a".repeat(78);

  it("accepts valid 78-char puuid", () => {
    expect(puuidSchema.safeParse(validPuuid).success).toBe(true);
  });

  it("rejects too-short puuid", () => {
    expect(puuidSchema.safeParse("short").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(puuidSchema.safeParse("").success).toBe(false);
  });
});

describe("kdaSchema", () => {
  it("accepts valid KDA like 5/2/3", () => {
    expect(kdaSchema.safeParse("5/2/3").success).toBe(true);
  });

  it("accepts KDA with double digits", () => {
    expect(kdaSchema.safeParse("15/10/20").success).toBe(true);
  });

  it("rejects KDA with negative numbers", () => {
    expect(kdaSchema.safeParse("-1/2/3").success).toBe(false);
  });

  it("rejects KDA with extra slashes", () => {
    expect(kdaSchema.safeParse("5/2/3/1").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(kdaSchema.safeParse("").success).toBe(false);
  });
});

describe("localeSchema", () => {
  it("accepts ja", () => {
    expect(localeSchema.safeParse("ja").success).toBe(true);
  });

  it("accepts en", () => {
    expect(localeSchema.safeParse("en").success).toBe(true);
  });

  it("accepts ko", () => {
    expect(localeSchema.safeParse("ko").success).toBe(true);
  });

  it("defaults to ja for undefined", () => {
    const result = localeSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("ja");
  });

  it("rejects unsupported locale", () => {
    expect(localeSchema.safeParse("fr").success).toBe(false);
  });
});

describe("framesArraySchema", () => {
  it("accepts empty array", () => {
    expect(framesArraySchema.safeParse([]).success).toBe(true);
  });

  it("accepts array with valid base64 strings", () => {
    expect(framesArraySchema.safeParse(["data:image/png;base64,abc"]).success).toBe(true);
  });

  it("rejects array with more than 10 frames", () => {
    const frames = Array(11).fill("data:image/png;base64,abc");
    expect(framesArraySchema.safeParse(frames).success).toBe(false);
  });
});

describe("jobIdSchema", () => {
  it("accepts valid UUID", () => {
    expect(jobIdSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
  });

  it("rejects non-UUID string", () => {
    expect(jobIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});

describe("validateInput helper", () => {
  it("returns success with parsed data for valid input", () => {
    const result = validateInput(championNameSchema, "Ahri");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("Ahri");
  });

  it("returns error message for invalid input", () => {
    const result = validateInput(championNameSchema, "");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Validation error");
  });

  it("rejects null input", () => {
    const result = validateInput(matchIdSchema, null);
    expect(result.success).toBe(false);
  });
});
