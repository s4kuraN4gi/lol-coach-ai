// ─── Riot API Constants ──────────────────────────────────────────
// NOTE: No "use server" — this file only exports constants / helpers,
// not async server actions.

export const RIOT_API_KEY = process.env.RIOT_API_KEY;
export const REGION_ROUTING = "asia"; // Account V1, Match V5 (Asia/Sea)
export const PLATFORM_ROUTING = "jp1"; // Summoner V4, League V4 (Japan)

// ─── Helper ──────────────────────────────────────────────────────

export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
