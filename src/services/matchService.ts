
import { createClient } from "@/utils/supabase/server";
import { fetchMatchIds, fetchMatchDetail } from "@/app/actions/riot";
import { pruneMatchData } from "@/utils/optimizer";
import type { MatchV5Response } from "@/app/actions/riot/types";

// Rate limit safe fetcher
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function fetchAndCacheMatches(puuid: string, count: number = 20): Promise<{ matches: MatchV5Response[], logs: string[] }> {
    const logs: string[] = [];
    const log = (msg: string) => { logs.push(msg); };
    const matches: MatchV5Response[] = [];

    try {
        const supabase = await createClient();

        // 1. Fetch Match IDs
        const idsRes = await fetchMatchIds(puuid, count);
        if (!idsRes.success || !idsRes.data) {
            log(`Failed to fetch match IDs: ${idsRes.error}`);
            return { matches: [], logs };
        }

        const matchIds = idsRes.data;
        log(`[Service] Found ${matchIds.length} match IDs`);

        // 2. Cache Check
        const cachedMap = new Map<string, MatchV5Response>();
        
        try {
            // Query Supabase for existing matches
            const { data: cachedMatches, error: cacheError } = await supabase
                .from('match_cache')
                .select('match_id, data')
                .in('match_id', matchIds);
            
            if (cacheError) {
                log(`[Service] Cache Lookup Failed: ${cacheError.message}`);
            } else if (cachedMatches) {
                cachedMatches.forEach((row) => {
                    // Cache Validation: Check if CS metrics exist
                    const p = row.data.info?.participants?.[0];
                    const hasCsData = p?.challenges && (
                        'laneMinionsFirst10Minutes' in p.challenges || 
                        'jungleCsBefore10Minutes' in p.challenges
                    );
                    
                    if (hasCsData) {
                        cachedMap.set(row.match_id, row.data);
                    } 
                });
                log(`[Service] Cache Hit (Valid): ${cachedMap.size} / ${cachedMatches.length}`);
            }
        } catch (dbErr) {
            log(`[Service] Unexpected DB Error: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
        }

        const missingIds = matchIds.filter(id => !cachedMap.has(id));
        log(`[Service] Missing IDs: ${missingIds.length}`);

        // 3. Fetch Missing from Riot
        // OPTIMIZED: Fetch prompt all missing matches (no hard limit of 10)
        const matchesToFetch = missingIds; // Removed .slice(0, 10)
        if (matchesToFetch.length > 0) log(`[Service] Fetching ${matchesToFetch.length} new matches...`);

        const newMatches: MatchV5Response[] = [];
        if (matchesToFetch.length > 0) {
            const chunkSize = 8; // Increased from 5 -> 8 for speed
            const chunkedIds = [];
            for (let i = 0; i < matchesToFetch.length; i += chunkSize) {
                chunkedIds.push(matchesToFetch.slice(i, i + chunkSize));
            }

            for (const chunk of chunkedIds) {
                // Initial Attempt
                const promises = chunk.map(mid => fetchMatchDetail(mid));
                let results = await Promise.all(promises);

                const failedIds: string[] = [];
                let hasRateLimitError = false;
                let maxRetryAfterMs = 0;

                // Process Results & Identify Failures
                results.forEach((detail, idx) => {
                    const matchId = chunk[idx];
                    if (detail.success && detail.data) {
                        const optimized = pruneMatchData(detail.data);
                        newMatches.push(optimized);
                        cachedMap.set(matchId, optimized);
                    } else {
                        failedIds.push(matchId);
                        if (detail.error?.includes('429')) {
                            hasRateLimitError = true;
                            if (detail.retryAfterMs && detail.retryAfterMs > maxRetryAfterMs) {
                                maxRetryAfterMs = detail.retryAfterMs;
                            }
                        }
                        log(`[Service] Failed to fetch match ${matchId}: ${detail.error}`);
                    }
                });

                // BACKOFF & RETRY LOGIC
                if (failedIds.length > 0) {
                    if (hasRateLimitError) {
                        const MIN_RATE_LIMIT_BACKOFF = 3000;
                        const backoffMs = Math.max(maxRetryAfterMs > 0 ? maxRetryAfterMs + 1000 : 5000, MIN_RATE_LIMIT_BACKOFF);
                        log(`[Service] ⚠️ 429 Rate Limit Detected. Backoff ${Math.round(backoffMs / 1000)}s${maxRetryAfterMs > 0 ? ' (Retry-After)' : ' (fallback)'}...`);
                        await delay(backoffMs);
                    } else {
                        // For non-429 errors (network blip?), small wait
                        await delay(1000);
                    }

                    log(`[Service] 🔄 Retrying ${failedIds.length} failed matches...`);
                    const retryPromises = failedIds.map(mid => fetchMatchDetail(mid));
                    const retryResults = await Promise.all(retryPromises);

                    retryResults.forEach((detail, idx) => {
                        const matchId = failedIds[idx];
                        if (detail.success && detail.data) {
                            const optimized = pruneMatchData(detail.data);
                            newMatches.push(optimized);
                            cachedMap.set(matchId, optimized);
                            log(`[Service] ✅ Retry Success: ${matchId}`);
                        } else {
                            log(`[Service] ❌ Retry Failed (Skipping): ${matchId} - ${detail.error}`);
                        }
                    });
                }
                
                // Reduced delay for speed (200ms -> 100ms)
                if (chunkedIds.length > 1) await delay(100);
            }
        }

        // 4. Save to Cache
        if (newMatches.length > 0) {
            try {
                const rows = newMatches.map(m => ({
                    match_id: m.metadata.matchId,
                    data: m
                }));
                
                const { error: insertError } = await supabase
                    .from('match_cache')
                    .upsert(rows, { onConflict: 'match_id', ignoreDuplicates: true });
                
                if (insertError) log(`[Service] Cache Insert Error: ${insertError.message}`);
                else log(`[Service] Cached ${rows.length} new matches`);
            } catch (dbErr) {
                log(`[Service] Cache Insert Exception: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
            }
        }

        // 5. Aggregate Results
        // Use matchIds order to return matches
        matchIds.forEach(id => {
            const m = cachedMap.get(id);
            if (m) matches.push(m);
        });

        return { matches, logs };

    } catch (e) {
        log(`[Service] Critical Error: ${e instanceof Error ? e.message : String(e)}`);
        return { matches: [], logs };
    }
}

// Check cache for specific IDs (No API Fetch)
export async function getCachedMatchesByIds(matchIds: string[]): Promise<MatchV5Response[]> {
    if (!matchIds.length) return [];
    
    const supabase = await createClient();
    const { data } = await supabase
        .from('match_cache')
        .select('data')
        .in('match_id', matchIds);

    return (data || []).map(d => d.data);
}
