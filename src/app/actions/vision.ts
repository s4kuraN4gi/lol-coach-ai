'use server';

import { createClient } from "@/utils/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs/promises';
import path from 'path';
import { getAnalysisStatus } from "./analysis";
import { FREE_WEEKLY_ANALYSIS_LIMIT, PREMIUM_WEEKLY_ANALYSIS_LIMIT } from "./constants";
import { fetchMatchDetail, fetchLatestVersion, fetchMatchTimeline, extractMatchEvents, getChampionAttributes } from "./riot";

const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;

type VisionAnalysisRequest = {
    frames: string[]; // Base64 Data URLs
    question?: string;
    description?: string;
    matchId?: string; // For Hybrid Analysis
    puuid?: string;   // For Identification
    language?: 'ja' | 'en' | 'ko'; // Output language
    analysisStartGameTime?: number; // Game time in seconds when analysis starts
    analysisEndGameTime?: number;   // Game time in seconds when analysis ends
};

// === NEW: Enhanced Micro Analysis Types ===

export type PlayerStatus = {
    hpPercent: number;        // 0-100
    manaPercent: number;      // 0-100
    level: number;            // 1-18
    ultimateReady: boolean | "unknown";
    summonerSpells: string;   // e.g., "Flash ✓ / Ignite ✓"
    keyAbilitiesReady: string; // e.g., "Q✓ W✓ E✗"
};

export type SituationSnapshot = {
    gameTime: string;         // "mm:ss"
    myStatus: PlayerStatus;
    enemyStatus: PlayerStatus;
    environment: {
        minionAdvantage: string;   // e.g., "6 vs 3 (advantage)"
        wavePosition: string;      // "frozen" | "pushing" | "pulling" | "center"
        junglerThreat: string;     // "visible top" | "unknown" | "likely bot"
        visionControl: string;     // "river warded" | "no vision"
    };
};

export type TradeAnalysis = {
    tradeOccurred: boolean;
    outcome: "WIN" | "LOSE" | "EVEN" | "NO_TRADE";
    hpExchanged: {
        damageGiven: string;      // e.g., "~30%"
        damageTaken: string;      // e.g., "~50%"
    };
    reason: string;               // Why the trade was won/lost
    shouldHaveTraded: boolean;    // Was this a good time to trade?
    optimalAction: string;        // What should have been done
    cooldownContext: string;      // e.g., "Enemy Q was on 6s CD"
};

export type SkillEvaluation = {
    skill: string;                // "Q" | "W" | "E" | "R" | "Flash" etc.
    used: boolean;
    hit: boolean | "N/A";         // N/A for self-buff skills
    timing: "PERFECT" | "GOOD" | "EARLY" | "LATE" | "MISSED_OPPORTUNITY";
    note: string;                 // Context about the usage
};

export type DodgeEvaluation = {
    enemySkill: string;           // e.g., "Ahri E"
    dodged: boolean;
    method: string;               // "sidestep" | "flash" | "ability" | "failed"
    difficulty: "EASY" | "MEDIUM" | "HARD";
};

export type MechanicsEvaluation = {
    skillsUsed: SkillEvaluation[];
    skillsDodged: DodgeEvaluation[];
    autoAttackWeaving: "EXCELLENT" | "GOOD" | "NEEDS_WORK" | "POOR";
    comboExecution: string;       // Description of combo performance
    positioningScore: "EXCELLENT" | "GOOD" | "RISKY" | "POOR";
    positioningNote: string;      // Why the positioning was good/bad
};

export type Improvement = {
    priority: "HIGH" | "MEDIUM" | "LOW";
    category: "TRADING" | "DODGING" | "COOLDOWN_TRACKING" | "POSITIONING" | "COMBO" | "WAVE_CONTROL" | "RESOURCE_MANAGEMENT";
    title: string;
    currentBehavior: string;      // What the player did
    idealBehavior: string;        // What they should do
    practice: string;             // How to practice this
    championSpecific: boolean;    // Is this advice specific to their champion?
};

// Enhanced result type (backward compatible)
export type VisionAnalysisResult = {
    // Legacy fields (for backward compatibility)
    observed_champions: { name: string; evidence: string }[];
    summary: string;
    mistakes: {
        timestamp: string;
        title: string;
        severity: "CRITICAL" | "MINOR";
        advice: string;
    }[];
    finalAdvice: string;
    timeOffset?: number;

    // NEW: Enhanced micro analysis fields
    enhanced?: {
        situationSnapshot: SituationSnapshot;
        tradeAnalysis: TradeAnalysis;
        mechanicsEvaluation: MechanicsEvaluation;
        improvements: Improvement[];
        championContext: {
            championName: string;
            role: string;              // "Assassin" | "Mage" | "ADC" etc.
            playstyleAdvice: string;   // Role-specific general advice
            keyCombo: string;          // Champion's key combo to practice
        };
        skillLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
        overallGrade: "S" | "A" | "B" | "C" | "D";
    };
};

export async function startVisionAnalysis(
    request: VisionAnalysisRequest,
    userApiKey?: string
): Promise<{ success: boolean; jobId?: string; error?: string }> {
    // Log entry point with request size
    const frameCount = request.frames?.length || 0;
    const totalFrameSize = request.frames?.reduce((sum, f) => sum + f.length, 0) || 0;
    console.log(`[startVisionAnalysis] Entry - Frames: ${frameCount}, Size: ${Math.round(totalFrameSize / 1024)}KB, MatchId: ${request.matchId}`);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        console.log("[startVisionAnalysis] Not authenticated");
        return { success: false, error: "Not authenticated" };
    }
    console.log("[startVisionAnalysis] User authenticated:", user.id);

    // 1. Initial Limit/Auth Check (Fail fast)
    const status = await getAnalysisStatus();
    if (!status) return { success: false, error: "User profile not found." };

    // Check availability only (Consumption happens later or we assume success)
    const weeklyCount = status.weekly_analysis_count || 0;
    if (status.is_premium) {
        if (weeklyCount >= PREMIUM_WEEKLY_ANALYSIS_LIMIT) return { success: false, error: `週間制限に達しました (${weeklyCount}/${PREMIUM_WEEKLY_ANALYSIS_LIMIT})。月曜日にリセットされます。` };
    } else {
        // Free users: 3 analyses per week (unless using own API key)
        if (!userApiKey && weeklyCount >= FREE_WEEKLY_ANALYSIS_LIMIT) return { success: false, error: `無料プランの週間制限に達しました (${weeklyCount}/${FREE_WEEKLY_ANALYSIS_LIMIT})。月曜日にリセットされます。プレミアムプランへのアップグレードで週20回まで分析できます。` };
    }

    // 2. Create Job Record
    // We do NOT store frames in DB (too large). Frames are passed in memory to the detached worker.
    const { data: job, error: jobError } = await supabase
        .from("video_analyses")
        .insert({
            user_id: user.id,
            match_id: request.matchId || "unknown", // Optional linkage
            status: "processing",
            analysis_type: "micro",  // Required for result restoration
            result: null, // Set later
            inputs: {
                mode: "MICRO",
                description: request.description,
                question: request.question,
                timestamp: new Date().toISOString()
            }
        })
        .select()
        .single();

    if (jobError || !job) {
        console.error("Failed to create vision job:", jobError);
        return { success: false, error: "Database Error: Could not start analysis job." };
    }

    // 3. Trigger Async Processing (Fire & Forget)
    // We explicitly DO NOT await this.
    console.log(`[startVisionAnalysis] Starting async job: ${job.id}`);
    (async () => {
        try {
            await performVisionAnalysis(job.id, request, user.id, userApiKey);
        } catch (e) {
            console.error(`[Vision Job ${job.id}] Uncaught specific error:`, e);
        }
    })();

    const response = { success: true, jobId: job.id };
    console.log(`[startVisionAnalysis] Returning:`, JSON.stringify(response));
    return response;
}

// Internal Worker Function (Detached)
async function performVisionAnalysis(
    jobId: string, 
    request: VisionAnalysisRequest, 
    userId: string,
    userApiKey?: string
) {
    const supabase = await createClient();
    let status: any = null;
    let debited = false;
    let shouldIncrementCount = false;
    let useEnvKey = false;
    
    try {
        // --- Limit Check Again (Double safe) & Key Setup ---
        status = await getAnalysisStatus();
        if (!status) throw new Error("User profile missing during processing.");
        
        const weeklyCount = status.weekly_analysis_count || 0;
        if (status.is_premium) {
            useEnvKey = true;
            shouldIncrementCount = true;
            // Weekly limit check for premium
            if (weeklyCount >= PREMIUM_WEEKLY_ANALYSIS_LIMIT) {
                throw new Error(`週間制限に達しました (${weeklyCount}/${PREMIUM_WEEKLY_ANALYSIS_LIMIT})。月曜日にリセットされます。`);
            }
        } else {
             if (userApiKey) { useEnvKey = false; }
             else {
                 // Free user using env key: check weekly limit
                 if (weeklyCount >= FREE_WEEKLY_ANALYSIS_LIMIT) {
                     throw new Error(`無料プランの週間制限に達しました (${weeklyCount}/${FREE_WEEKLY_ANALYSIS_LIMIT})。月曜日にリセットされます。`);
                 }
                 useEnvKey = true;
                 shouldIncrementCount = true;
             }
        }

        const apiKeyToUse = useEnvKey ? GEMINI_API_KEY_ENV : userApiKey;
        if (!apiKeyToUse) throw new Error("API Key Not Found");

        // [DEBIT FIRST] - Both premium and free users increment weekly count
        if (shouldIncrementCount) {
             // Increment weekly count (reset is handled by getAnalysisStatus)
             const newWeeklyCount = (status.weekly_analysis_count || 0) + 1;
             await supabase.from("profiles").update({ weekly_analysis_count: newWeeklyCount }).eq("id", userId);
             debited = true;
        }

        // --- CORE ANALYSIS LOGIC (Copied from original) ---
        const version = await fetchLatestVersion(); // Fetch latest version

        // 1. MATCH CONTEXT & Truth Injection
        let matchContextStr = "";
        let myChampName = "Unknown";
        let truthEvents: any[] = [];
        let champAttrs: any = null;
        
        if (request.matchId && request.puuid) {
            console.log(`[Vision Job ${jobId}] Fetching match context...`);
            const [matchRes, timelineRes] = await Promise.all([
                fetchMatchDetail(request.matchId),
                fetchMatchTimeline(request.matchId)
            ]);

            if (matchRes.success && matchRes.data) {
                const parts = matchRes.data.info.participants;
                const me = parts.find((p: any) => p.puuid === request.puuid);
                const myTeamId = me ? me.teamId : 0;
                if (me) {
                     myChampName = me.championName;
                     // Fetch Champion Attributes
                     champAttrs = await getChampionAttributes(me.championName);
                }
                const allies = parts.filter((p: any) => p.teamId === myTeamId).map((p: any) => `${p.championName} (${p.teamPosition})`);
                const enemies = parts.filter((p: any) => p.teamId !== myTeamId).map((p: any) => `${p.championName} (${p.teamPosition})`);

                 matchContextStr = `
                【コンテキスト (Identity)】
                視点主（あなた）: ${myChampName}
                ・役割: ${champAttrs?.identity || "不明"} (クラス: ${champAttrs?.class || "不明"})
                ・特性ノート: ${champAttrs?.notes || "なし"}
                
                味方チーム: ${allies.join(", ")}
                敵チーム: ${enemies.join(", ")}
                ※ 画像認識で迷った場合は、**必ずこのリストの中から**選んでください。
                `;
            }

            // Extract Truth Events (Wide Window fallback)
            // Ideally we wait for TimeSync result, but for now we fetch ALL relevant events or wide window.
            // Since we don't know exact game time yet (we ask AI to find it), we pass a loose set or empty first?
            // BETTER: We can't filter by time efficiently without knowing time.
            // STRATEGY: We inject KEY events (Kills/Objectives) for the WHOLE game? Too big.
            // We'll ask AI to find time, then we verify? No, one shot.
            // Fallback: We rely on AI finding time first in a previous step?
            // No, user wants it now.
            // Compromise: We fetch all "Elite Monster Kills" and "My Deaths" for the whole game.
            if (timelineRes.success) {
                const allEvents = await extractMatchEvents(timelineRes.data, request.puuid);
                // Filter to critical ones to limit token usage if needed, or just pass first 50 relevant.
                truthEvents = allEvents.filter(e => e.type === 'KILL' || e.type === 'OBJECTIVE');
            }
        }

        const modelsToTry = [
            "gemini-2.5-flash",
            "gemini-1.5-pro",
            "gemini-2.0-flash-001",
            "gemini-2.0-flash-lite"
        ];
        const errors: string[] = [];
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        let analysisData: VisionAnalysisResult | null = null;
        let success = false;

        for (const modelName of modelsToTry) {
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount <= maxRetries) {
                try {
                    console.log(`[Vision Job ${jobId}] Attempting ${modelName} (Try ${retryCount + 1})`);
                    const genAI = new GoogleGenerativeAI(apiKeyToUse);
                    const model = genAI.getGenerativeModel({
                        model: modelName,
                        generationConfig: {
                            responseMimeType: "application/json",
                            temperature: 0.0,
                            maxOutputTokens: 8192 // Ensure complete JSON response
                        }
                    });

                    // Determine output language
                    const lang = request.language || 'ja';
                    const langInstructions = {
                        ja: '**重要**: 以下のJSONフィールドは全て日本語で出力してください: summary, mistakes[].title, mistakes[].advice, finalAdvice, tradeAnalysis.reason, tradeAnalysis.optimalAction, tradeAnalysis.cooldownContext, skillsUsed[].note, mechanicsEvaluation.comboExecution, mechanicsEvaluation.positioningNote, improvements[].title, improvements[].currentBehavior, improvements[].idealBehavior, improvements[].practice, championContext.playstyleAdvice, championContext.keyCombo, environment内の説明文。\nenumの値(WIN/LOSE, HIGH/MEDIUM/LOW, PERFECT/GOODなど)は英語のままにしてください。',
                        en: '**IMPORTANT**: Output ALL text fields in English: summary, mistakes[].title, mistakes[].advice, finalAdvice, tradeAnalysis.reason, tradeAnalysis.optimalAction, tradeAnalysis.cooldownContext, skillsUsed[].note, mechanicsEvaluation.comboExecution, mechanicsEvaluation.positioningNote, improvements[].title, improvements[].currentBehavior, improvements[].idealBehavior, improvements[].practice, championContext.playstyleAdvice, championContext.keyCombo, environment descriptions.\nKeep enum values (WIN/LOSE, HIGH/MEDIUM/LOW, PERFECT/GOOD, etc.) in English.',
                        ko: '**중요**: 다음 JSON 필드는 모두 한국어로 출력하세요: summary, mistakes[].title, mistakes[].advice, finalAdvice, tradeAnalysis.reason, tradeAnalysis.optimalAction, tradeAnalysis.cooldownContext, skillsUsed[].note, mechanicsEvaluation.comboExecution, mechanicsEvaluation.positioningNote, improvements[].title, improvements[].currentBehavior, improvements[].idealBehavior, improvements[].practice, championContext.playstyleAdvice, championContext.keyCombo, environment 설명문.\nenum 값(WIN/LOSE, HIGH/MEDIUM/LOW, PERFECT/GOOD 등)은 영어로 유지하세요.'
                    };

                    // Filter truth events by analysis time range if provided
                    let relevantTruthEvents = truthEvents;
                    if (request.analysisStartGameTime !== undefined && request.analysisEndGameTime !== undefined) {
                        const startMs = request.analysisStartGameTime * 1000;
                        const endMs = request.analysisEndGameTime * 1000;
                        relevantTruthEvents = truthEvents.filter((e: any) =>
                            e.timestamp >= startMs && e.timestamp <= endMs
                        );
                        console.log(`[Vision Job ${jobId}] Filtered truth events: ${relevantTruthEvents.length} (from ${truthEvents.length})`);
                    }

                    const promptText = `
You are an elite League of Legends micro-mechanics coach specializing in mechanical skill analysis, combat execution, and in-the-moment decision making.

${langInstructions[lang]}

**【CONTEXT】**
${matchContextStr}

**【IMPORTANT RULES】**
- **MICRO ONLY**: Do NOT mention macro strategy (dragon control, lane rotation, map movements). Focus ONLY on mechanical execution.
- **NO BLAME**: Do not criticize teammates or external factors.
- **EVIDENCE-BASED**: Only reference kills/deaths from the Truth Events below. Do not hallucinate events.

**【TRUTH EVENTS (from Riot API)】**
${JSON.stringify(relevantTruthEvents.slice(0, 20))}

**【ANALYSIS FRAMEWORK】**

1. **SITUATION SNAPSHOT**: Read the screen to determine:
   - HP%, Mana%, Level of BOTH players (estimate from health bars)
   - Which abilities appear to be on cooldown (grey icons)
   - Minion count advantage (count the minions!)
   - Wave position relative to towers

2. **TRADE ANALYSIS**: If any damage exchange occurred:
   - Who won the trade and by how much HP?
   - WHY did they win/lose? (cooldowns, minion aggro, positioning)
   - Was it the right time to trade based on resources?

3. **MECHANICS EVALUATION**:
   - **Skill Usage**: Did they hit skillshots? Good timing?
   - **Skill Dodging**: Did they dodge enemy abilities? How?
   - **Auto-Attack Weaving**: Are they weaving AAs between abilities?
   - **Positioning**: Are they in a safe position relative to enemy threat range?

4. **CHAMPION-SPECIFIC ANALYSIS**:
   - Champion: ${myChampName}
   - Class: ${champAttrs?.class || 'Unknown'}
   - Identity: ${champAttrs?.identity || 'Unknown'}
   - For ${champAttrs?.class || 'this champion'}, evaluate their role-specific execution:
     ${champAttrs?.class === 'Assassin' ? '- Did they look for opportunities to burst squishies?\n- Did they manage their escape/engage cooldowns?' : ''}
     ${champAttrs?.class === 'Marksman' || champAttrs?.class === 'ADC' ? '- Are they kiting properly (attack-move)?\n- Are they maintaining safe distance while dealing damage?' : ''}
     ${champAttrs?.class === 'Mage' ? '- Are they spacing correctly for their range?\n- Are they using abilities at optimal range?' : ''}
     ${champAttrs?.class === 'Fighter' || champAttrs?.class === 'Bruiser' ? '- Are they managing their sustained damage correctly?\n- Are they using defensive abilities at the right time?' : ''}
     ${champAttrs?.class === 'Tank' ? '- Are they absorbing damage for carries?\n- Are they using CC at optimal times?' : ''}
     ${champAttrs?.class === 'Support' ? '- Are they protecting their carry?\n- Are they landing key CC abilities?' : ''}

5. **SKILL LEVEL ASSESSMENT**: Based on the observed mechanics, estimate if the player is:
   - BEGINNER: Missing basic mechanics, needs fundamentals
   - INTERMEDIATE: Has basics but inconsistent execution
   - ADVANCED: Good mechanics but needs optimization

**Current LoL Version: ${version}**
**User Question: ${request.question || "Analyze my mechanics and give improvement advice."}**

**【OUTPUT FORMAT (JSON)】**
{
    "observed_champions": [{ "name": "ChampionName", "evidence": "How you identified them" }],
    "summary": "Brief factual summary of what happened in the clip",
    "mistakes": [
        { "timestamp": "mm:ss", "title": "Short title", "severity": "CRITICAL" | "MINOR", "advice": "Specific fix" }
    ],
    "finalAdvice": "Overall micro advice summary",
    "initialGameTime": "mm:ss",
    "enhanced": {
        "situationSnapshot": {
            "gameTime": "mm:ss",
            "myStatus": {
                "hpPercent": 0-100,
                "manaPercent": 0-100,
                "level": 1-18,
                "ultimateReady": true/false/"unknown",
                "summonerSpells": "Flash ✓ / Ignite ✓",
                "keyAbilitiesReady": "Q✓ W✓ E✗"
            },
            "enemyStatus": {
                "hpPercent": 0-100,
                "manaPercent": 0-100,
                "level": 1-18,
                "ultimateReady": true/false/"unknown",
                "summonerSpells": "Flash ? / Teleport ?",
                "keyAbilitiesReady": "Q? W✓ E?"
            },
            "environment": {
                "minionAdvantage": "6 vs 3 (advantage)",
                "wavePosition": "center" | "pushing" | "pulling" | "frozen",
                "junglerThreat": "unknown" | "visible top" | "likely bot",
                "visionControl": "river warded" | "no vision"
            }
        },
        "tradeAnalysis": {
            "tradeOccurred": true/false,
            "outcome": "WIN" | "LOSE" | "EVEN" | "NO_TRADE",
            "hpExchanged": { "damageGiven": "~30%", "damageTaken": "~50%" },
            "reason": "Why the trade was won/lost",
            "shouldHaveTraded": true/false,
            "optimalAction": "What should have been done instead",
            "cooldownContext": "Enemy Q was on ~6s cooldown"
        },
        "mechanicsEvaluation": {
            "skillsUsed": [
                { "skill": "Q", "used": true, "hit": true, "timing": "GOOD", "note": "Hit enemy during their animation" }
            ],
            "skillsDodged": [
                { "enemySkill": "Ahri E", "dodged": true, "method": "sidestep", "difficulty": "MEDIUM" }
            ],
            "autoAttackWeaving": "GOOD" | "NEEDS_WORK" | "POOR",
            "comboExecution": "Description of combo performance",
            "positioningScore": "GOOD" | "RISKY" | "POOR",
            "positioningNote": "Why positioning was good/bad"
        },
        "improvements": [
            {
                "priority": "HIGH" | "MEDIUM" | "LOW",
                "category": "TRADING" | "DODGING" | "COOLDOWN_TRACKING" | "POSITIONING" | "COMBO" | "RESOURCE_MANAGEMENT",
                "title": "Short improvement title",
                "currentBehavior": "What player is doing now",
                "idealBehavior": "What they should do",
                "practice": "How to practice this",
                "championSpecific": true/false
            }
        ],
        "championContext": {
            "championName": "${myChampName}",
            "role": "${champAttrs?.class || 'Unknown'}",
            "playstyleAdvice": "General advice for this champion/role",
            "keyCombo": "The key combo to master for this champion"
        },
        "skillLevel": "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
        "overallGrade": "S" | "A" | "B" | "C" | "D"
    }
}
`;
    
                    const parts: any[] = [promptText];

                    // Limit frames to prevent overwhelming the model (max 30 frames for 30s clip)
                    const MAX_FRAMES = 30;
                    const framesToProcess = request.frames.slice(0, MAX_FRAMES);
                    if (request.frames.length > MAX_FRAMES) {
                        console.log(`[Vision Job ${jobId}] Limiting frames from ${request.frames.length} to ${MAX_FRAMES}`);
                    }

                    let totalFrameSize = 0;
                    framesToProcess.forEach((frame) => {
                        const matches = frame.match(/^data:(.+);base64,(.+)$/);
                        if (matches && matches.length === 3) {
                            totalFrameSize += matches[2].length;
                            parts.push({
                                inlineData: { data: matches[2], mimeType: matches[1] }
                            });
                        }
                    });

                    if (parts.length <= 1) throw new Error("No frames provided");
                    console.log(`[Vision Job ${jobId}] Sending ${parts.length - 1} frames to ${modelName} (total size: ${Math.round(totalFrameSize / 1024)}KB)`);

                    let rawText: string;
                    try {
                        const result = await model.generateContent(parts);
                        rawText = result.response.text();
                    } catch (genError: any) {
                        console.error(`[Vision Job ${jobId}] Gemini generation error:`, genError.message);
                        throw new Error(`Gemini API Error: ${genError.message}`);
                    }

                    const text = rawText.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");

                    console.log(`[Vision Job ${jobId}] Response length: ${text.length} chars`);
                    console.log(`[Vision Job ${jobId}] Response preview: ${text.substring(0, 500)}...`);

                    // Safety check: Response should not exceed 100KB for a JSON analysis
                    const MAX_RESPONSE_SIZE = 100 * 1024; // 100KB
                    if (text.length > MAX_RESPONSE_SIZE) {
                        console.error(`[Vision Job ${jobId}] Response too large: ${text.length} chars (max: ${MAX_RESPONSE_SIZE})`);
                        console.error(`[Vision Job ${jobId}] Response starts with: ${text.substring(0, 1000)}`);
                        throw new Error(`Response too large (${Math.round(text.length / 1024)}KB). Model returned unexpected data.`);
                    }

                    // Check for truncated response
                    const trimmedText = text.trim();
                    if (!trimmedText.endsWith('}')) {
                        console.warn(`[Vision Job ${jobId}] Response appears truncated (length: ${text.length}, ends with: ${trimmedText.slice(-50)})`);
                        throw new Error(`Response truncated (${text.length} chars). Try reducing frame count.`);
                    }

                    try {
                        analysisData = JSON.parse(text) as VisionAnalysisResult;

                        // --- Time Sync Calculation ---
                        if ((analysisData as any).initialGameTime) {
                             const initTimeStr = (analysisData as any).initialGameTime;
                             const [m, s] = initTimeStr.split(':').map(Number);
                             if (!isNaN(m) && !isNaN(s)) {
                                 // Standard: The first frame used is approximately at t=0 of the *analyzed segment*
                                 // But wait, the client extracts frames. The first frame passed IS the start.
                                 // So Video Start Time (0s relative to passed frames) = initTimeStr
                                 // videoTime (0) - gameTime (initTime) = offset
                                 const gameTimeSec = m * 60 + s;
                                 analysisData.timeOffset = 0 - gameTimeSec; 
                                 
                                 // Wait, if video starts at 60s (skipped loading), client frames might be from 60s?
                                 // Actually no, for the AI, the first frame IS "Frame 1".
                                 // But we need to know the VIDEO FILE timestamp of "Frame 1".
                                 // The client sends just base64 frames. It does NOT send timestamps of frames currently.
                                 // This is a limitation. We assume Frame 1 is the "Start of Analysis".
                                 // If client skipped 60s, then Frame 1 is at 60s of the file.
                                 // We need `startTime` input in `VisionAnalysisRequest` to correspond to file time.
                                 // Currently `request` doesn't have it.
                                 // Plan: For now, assume Frame 1 corresponds to "Start of Video Context".
                                 // If the user skipped loading screen (frontend logic?), then we need that info.
                                 // But wait, `startVisionAnalysis` handles the job creation. The worker just gets frames.
                                 // The frames are extracted by `VideoProcessor`.
                                 // If VideoProcessor skipped 60s, Frame 1 is at 60s.
                                 // We need to pass `startTime` from Client.
                                 // Let's rely on Client passing accurate frames.
                                 // If we don't know the file timestamp of Frame 1, we can't calculate exact file offset.
                                 // CRITICAL: The prompt asks for "initialGameTime".
                                 // Let's assume for this MVP that Offset = (Start Video Time) - (Detected Game Time).
                                 // BUT we don't know Start Video Time here (it's in Client param).
                                 // Valid approach: Just return `initialGameTime` in result. 
                                 // Frontend can calculate offset: Offset = CurrentVideoTime - GameTime.
                                 // BUT backend saves `time_offset`.
                                 // Let's assume Frame 1 is roughly "Start of Analysis".
                                 // If we calculate offset here, we need Frame 1's file timestamp.
                                 // For now: Just save `initialGameTime` (in seconds) as `time_offset`? No.
                                 // Let's calculate a "Game Start Offset" relative to this specific analysis block.
                                 // Actually, simpler: 
                                 // `time_offset` = How many seconds needed to add to Game Time to get Video Time.
                                 // Frame 1 Video Time = X (unknown here, but usually 0 on short clips).
                                 // If we can't get X, we can't correct perfectly for long videos with skip.
                                 // Workaround: We will update `VisionAnalysisRequest` type to optionally include `frameTimestamps`.
                                 // But since I can't easily change Client -> Server contract for large payload structure without risk,
                                 // I will assume Frame 1 is at 0s of the *clip sent* or rely on `initialGameTime` being returned
                                 // and let the frontend update the DB or Local State?
                                 // No, the task is to save `time_offset` to DB.
                                 // Let's simply save the `initialGameTime` in seconds as a NEGATIVE value (Game Time Start).
                                 // E.g. if Game shows 00:00, offset is 0.
                                 // If Game shows 01:00, offset is -60. (Video 0 = Game 60).
                                 // This implies Video Time = Game Time + Offset.
                                 // 0 = 60 + (-60). Correct.
                                 // This assumes the video starts at the frame we analyzed.
                                 analysisData.timeOffset = -gameTimeSec;
                             }
                        }
                        
                        success = true;
                    } catch (parseError: any) {
                        // Parse error - log more details
                        console.error(`[Vision Job ${jobId}] JSON Parse Error:`, parseError.message);
                        console.error(`[Vision Job ${jobId}] Response length: ${text.length}, last 200 chars: ${text.slice(-200)}`);
                        throw new Error(`JSON Parse Error (length: ${text.length}): ${parseError.message}`);
                    }

                    // Success!
                    break; 

                } catch (e: any) {
                    console.warn(`[Vision Job ${jobId}] Error ${modelName}:`, e.message);
                    errors.push(`${modelName}: ${e.message}`);
                    if (e.message?.includes('429')) {
                        await sleep(5000);
                        retryCount++;
                        continue;
                    }
                    break; // Next model
                }
            }
            if (success) break;
        }

        if (!success || !analysisData) {
            throw new Error(`All models failed: ${errors.join(" | ")}`);
        }

        // --- SUCCESS: Update DB & Stats ---

        // --- Post-Process Validation: Champion Detection ---
        // Verify observed_champions against match context if available
        if (analysisData.observed_champions && myChampName !== "Unknown") {
            const validChampions = new Set([myChampName.toLowerCase()]);
            // Add allies and enemies if we have matchContext
            const detectedValid = analysisData.observed_champions.filter((obs: any) => {
                const isValid = validChampions.has(obs.name?.toLowerCase());
                if (!isValid && obs.name) {
                    console.warn(`[Vision Validation] Detected champion "${obs.name}" not in match context - marking as unverified`);
                }
                return true; // Keep all for now, but mark
            });
            console.log(`[Vision] Champion detection: ${analysisData.observed_champions.length} champions found, ${detectedValid.filter((o: any) => validChampions.has(o.name?.toLowerCase())).length} verified against match`);
        }

        
        // --- SUCCESS: Update DB ---
        
        // 1. Update Job
        await supabase
            .from("video_analyses")
            .update({
                status: "completed",
                result: analysisData,
                time_offset: analysisData.timeOffset || 0, // Save extracted offset
                error: null
            })
            .eq("id", jobId);

    } catch (e: any) {
        console.error(`[Vision Job ${jobId}] FAILED:`, e);

        // [REFUND] - Decrement weekly count if analysis failed after debit
        try {
            if (debited && shouldIncrementCount) {
                const { data: currentProfile } = await supabase.from("profiles").select("weekly_analysis_count").eq("id", userId).single();
                if (currentProfile && currentProfile.weekly_analysis_count > 0) {
                    await supabase.from("profiles").update({
                        weekly_analysis_count: currentProfile.weekly_analysis_count - 1
                    }).eq("id", userId);
                }
            }
        } catch (refundError) {
            console.error("Refund failed", refundError);
        }

        await supabase
            .from("video_analyses")
            .update({
                status: "failed",
                error: e.message || "Unknown internal error"
            })
            .eq("id", jobId);
    }
}

// --- NEW: Match Integrity Check (Validation) ---
export type MatchVerificationResult = {
    isValid: boolean;
    reason: string;
    detectedChampion?: string;
    confidence: number;
};

export async function verifyMatchVideo(
    frames: string[],
    matchContext: {
        myChampion: string;
        allies: string[];
        enemies: string[];
    }
): Promise<{ success: boolean; data?: MatchVerificationResult; error?: string }> {
    // 1. Auth & minimal rate limiting check (skip credit deduction for verification)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    // [GUARD] Weekly Limit Check: Ensure user has remaining analyses
    const status = await getAnalysisStatus();
    if (!status) return { success: false, error: "User profile not found." };
    const weeklyCount = status.weekly_analysis_count || 0;
    const limit = status.is_premium ? PREMIUM_WEEKLY_ANALYSIS_LIMIT : FREE_WEEKLY_ANALYSIS_LIMIT;
    if (weeklyCount >= limit) {
        return { success: false, error: `週間制限に達しました (${weeklyCount}/${limit})。月曜日にリセットされます。${status.is_premium ? '' : 'プレミアムプランへのアップグレードで週20回まで分析できます。'}` };
    }

    if (!GEMINI_API_KEY_ENV) return { success: false, error: "Server Configuration Error" };

    // 2. Setup Lightweight Model (Flash) with Retry Logic
    // Prioritize 2.5 Flash as it is the 2025 Standard.
    const modelsToTry = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash-001"
    ];

    const errors: string[] = [];
    
    // Helper for delay
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (const modelName of modelsToTry) {
        try {
            console.log(`[Verify] Attempting model: ${modelName}`);
            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY_ENV);
            const model = genAI.getGenerativeModel({ 
                model: modelName, 
                generationConfig: { 
                    responseMimeType: "application/json",
                    temperature: 0.1 
                } 
            });

            const prompt = `
            あなたはLeague of Legendsの「Match Integrity Judge（不正防止審判）」です。
            ユーザーがアップロードした動画が、本当に「選択された試合データ」のものであるかを厳格に審査してください。
            
            【厳格な審査基準】
            1. **チャンピオン絶対一致則 (Zero Tolerance Identity Check)**: 
               - ターゲット: **${matchContext.myChampion}**
               - **最重要・必須条件**: 動画の**操作プレイヤー（視点主）**が **${matchContext.myChampion}** であること。
               - 画面中央に常に表示されているキャラクター、または画面下部のスキルアイコン、左下の顔アイコン、ヘルスバーの色（自キャラは緑/黄色）を確認してください。
               - **注意**: 単に ${matchContext.myChampion} が画面に映っているだけでは不十分です（味方や敵として映っている可能性）。そのキャラが「操作されている（POVである）」ことが必須です。
               - もし「操作キャラが誰かわからない」や「別のキャラを操作している」場合は、**迷わず** \`isValid: false\` にしてください。
               - "Likely match" や "Maybe" は禁止です。100%の確信がない限り \`false\` です。
               - 少しでも疑わしい場合、理由コードは "CHAMPION_MISMATCH" としてください。

            2. **チーム構成の確認**:
               - 味方 (${matchContext.allies.join(", ")}) や 敵 (${matchContext.enemies.join(", ")}) が1人でも確認できますか？
               - 全く異なるチャンピオン（例: LoLではないゲームのキャラ、リプレイのバグ表示）が映っている場合は \`isValid: false\` です。
               - 全く異なるチャンピオンが映っている場合は \`isValid: false\` で、理由コードは "TEAM_MISMATCH" です。

            【入力データ (正解)】
            - My Champion (MUST MATCH): ${matchContext.myChampion}
            - Allies: ${matchContext.allies.join(", ")}
            - Enemies: ${matchContext.enemies.join(", ")}

            【出力形式 (JSON)】
            {
                "isValid": boolean, // 照合結果。動画と試合データに明らかな不整合があればfalse。
                "reason": "CHAMPION_MISMATCH | TEAM_MISMATCH | OTHER",
                "detectedChampion": "動画内で検出されたチャンピオン名",
                "confidence": 0.0 ~ 1.0
            }
            `;
    
            const parts: any[] = [prompt];
            frames.forEach(f => {
                parts.push({
                    inlineData: {
                        data: f,
                        mimeType: "image/jpeg"
                    }
                });
            });
    
            const result = await model.generateContent(parts);
            const response = await result.response;
            const text = response.text().replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");

            console.log(`[Verify] Response length from ${modelName}: ${text.length}`);

            // Safety check
            if (text.length > 50 * 1024) {
                console.error(`[Verify] Response too large: ${text.length}`);
                throw new Error("Response too large");
            }

            const data = JSON.parse(text) as MatchVerificationResult;
            console.log(`[Verify] Result from ${modelName}:`, data);

            return { success: true, data };
            
        } catch (e: any) {
            console.warn(`[Verify] Error using ${modelName}:`, e.message);
            // Include more context for JSON parse errors
            if (e.message?.includes('JSON') || e.message?.includes('parse')) {
                errors.push(`${modelName}: JSON Parse Error`);
            } else {
                errors.push(`${modelName}: ${e.message}`);
            }

            // If explicit 429, maybe wait? But here we just failover fast to next model
            // unless it's the last model.
            if (e.message?.includes('429') && modelName === modelsToTry[modelsToTry.length - 1]) {
                // Last model failed with 429, return error
            }
        }
    }

    return { success: false, error: `Verification All Failed: ${errors.join(", ")}` };
}
