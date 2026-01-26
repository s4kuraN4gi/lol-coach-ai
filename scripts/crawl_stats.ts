import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

// --- CONFIG ---
const REGION = "jp1"; 
const REGION_ROUTING = "asia";
const TARGET_PLAYER_COUNT = 3; // PROTOTYPE LIMIT (Default: 500)
const MATCH_COUNT_PER_PLAYER = 2; // PROTOTYPE LIMIT (Default: 20)
const DELAY_MS = 1500; // Personal Key: 20 requests/1 sec -> but safe side 1.5s
const RIOT_API_KEY = process.env.RIOT_API_KEY;

if (!RIOT_API_KEY) {
    console.error("RIOT_API_KEY is missing via process.env");
    process.exit(1);
}

// Supabase Init
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Must use Service Role for admin writes if needed
const supabase = createClient(supabaseUrl, supabaseKey);

// --- TYPES ---
type ChampionStatBuffer = {
    matches: number;
    roles: Record<string, number>; // "TOP": 5
    winsByTime: Record<string, { wins: number, total: number }>; // "0-25": {wins: 2, total: 4}
};
const statsBuffer: Record<number, ChampionStatBuffer> = {}; // ChampID -> Data
const champIdToName: Record<number, string> = {};

// --- HELPERS ---
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchRiot(url: string) {
    await sleep(DELAY_MS);
    const res = await fetch(url, { headers: { "X-Riot-Token": RIOT_API_KEY! } });
    if (!res.ok) throw new Error(`Riot API Error ${res.status}: ${url}`);
    return res.json();
}

async function run() {
    console.log("=== STARTING STATS CRAWLER (PROTOTYPE) ===");

    try {
        // 1. Get Challenger League
        console.log("Fetching Challenger League...");
        const leagueUrl = `https://${REGION}.api.riotgames.com/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5`;
        const leagueData = await fetchRiot(leagueUrl);
        const entries = leagueData.entries.slice(0, TARGET_PLAYER_COUNT); // Limit
        
        console.log(`Processing ${entries.length} players...`);

        const processedMatchIds = new Set<string>();

        for (const entry of entries) {
            try {
                // Get PUUID
                const puuid = entry.puuid;
                // const summonerUrl = `https://${REGION}.api.riotgames.com/lol/summoner/v4/summoners/${entry.summonerId}`;
                // const summoner = await fetchRiot(summonerUrl);
                // const puuid = summoner.puuid;

                // Get Matches
                const matchesUrl = `https://${REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=${MATCH_COUNT_PER_PLAYER}`;
                const matchIds: string[] = await fetchRiot(matchesUrl);

                for (const matchId of matchIds) {
                    if (processedMatchIds.has(matchId)) continue;
                    processedMatchIds.add(matchId);

                    console.log(`Analyzing Match: ${matchId}`);
                    try {
                        const matchDetailUrl = `https://${REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
                        const match = await fetchRiot(matchDetailUrl);
                        const durationMins = match.info.gameDuration / 60;
                        const version = match.info.gameVersion.split('.').slice(0, 2).join('.'); // "14.24"

                        // Analyze Participants
                        for (const p of match.info.participants) {
                            const cid = p.championId;
                            const cname = p.championName;
                            const role = p.teamPosition; // TOP, JUNGLE...
                            const win = p.win;

                            champIdToName[cid] = cname;

                            if (!statsBuffer[cid]) {
                                statsBuffer[cid] = { matches: 0, roles: {}, winsByTime: {} };
                            }
                            const buf = statsBuffer[cid];
                            buf.matches++;
                            
                            // Role
                            buf.roles[role] = (buf.roles[role] || 0) + 1;

                            // Time Bucket
                            let timeBucket = "LATE"; // Default >35
                            if (durationMins < 25) timeBucket = "EARLY";
                            else if (durationMins < 35) timeBucket = "MID";

                            if (!buf.winsByTime[timeBucket]) buf.winsByTime[timeBucket] = { wins: 0, total: 0 };
                            buf.winsByTime[timeBucket].total++;
                            if (win) buf.winsByTime[timeBucket].wins++;
                        }
                    } catch (e) {
                         console.error(`Failed match ${matchId}`, e);
                    }
                }
            } catch (e) {
                console.error(`Failed player ${entry.summonerName}`, e);
            }
        }

        console.log("=== AGGREGATING RESULTS ===");
        
        // Upsert to DB
        for (const cidStr of Object.keys(statsBuffer)) {
            const cid = Number(cidStr);
            const buf = statsBuffer[cid];
            const name = champIdToName[cid];
            if (!name) continue;

            // Calculate Role Distribution
            const totalMatches = buf.matches;
            const roleDist: Record<string, number> = {};
            let mainRole = "UNKNOWN";
            let maxRoleCount = 0;

            for (const [r, count] of Object.entries(buf.roles)) {
                roleDist[r] = Number((count / totalMatches).toFixed(2));
                if (count > maxRoleCount) {
                    maxRoleCount = count;
                    mainRole = r;
                }
            }

            // Calculate Power Spikes (Best Winrate Time)
            let bestTime = "MID";
            let maxWr = -1;
            for (const [time, data] of Object.entries(buf.winsByTime)) {
                if (data.total < 3) continue; // Noise filter
                const wr = data.wins / data.total;
                if (wr > maxWr) {
                    maxWr = wr;
                    bestTime = time;
                }
            }

            // Simple Identity Logic (Prototype)
            let identity = "FIGHTER"; // Default
            if (mainRole === "JUNGLE" && bestTime === "EARLY") identity = "EARLY_GANKER";
            if (mainRole === "TOP" && bestTime === "LATE") identity = "SPLIT_PUSHER"; // Simple heuristic
            if (mainRole === "UTILITY" || mainRole === "SUPPORT") identity = "SUPPORT";
            
            console.log(`Upserting ${name}: ${mainRole} / ${bestTime} / ${identity}`);

            // DB Upsert
            const { error } = await supabase.from('champion_stats').upsert({
                champion_id: cid,
                champion_name: name,
                patch_version: "14.24", // Mock
                role_distribution: roleDist,
                win_rate_by_time: buf.winsByTime,
                calculated_identity: identity,
                updated_at: new Date().toISOString()
            });

            if (error) console.error("DB Error:", error);
        }

        console.log("=== DONE ===");

    } catch (e) {
        console.error("Fatal Error:", e);
    }
}

run();
