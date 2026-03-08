"use server";

import { getGeminiClient, GEMINI_MODELS_TO_TRY } from "@/lib/gemini";
import { geminiRetry } from "@/lib/retry";
import { createClient as createServerClient, getUser } from "@/utils/supabase/server";
import { useGuestCredit, isGuestUser } from "../guestCredits";
import { refreshAnalysisStatus } from "../analysis";
import { FREE_WEEKLY_ANALYSIS_LIMIT, PREMIUM_WEEKLY_ANALYSIS_LIMIT } from "../constants";
import { fetchLatestVersion, fetchMatchDetail, fetchMatchTimeline, extractMatchEvents, getChampionAttributes } from "../riot";
import type { VisionAnalysisResult } from "../vision";
import type { MatchV5Participant } from "../riot/types";
import { logger } from "@/lib/logger";
import { verifyTurnstileToken } from "@/lib/turnstile";
import {
    type GuestMicroAnalysisRequest,
    type GuestMicroAnalysisResult,
    microAnalysisRequestSchema,
    GEMINI_API_KEY_ENV,
} from "./shared";

export async function performGuestMicroAnalysis(
    request: GuestMicroAnalysisRequest
): Promise<GuestMicroAnalysisResult> {
    // Input validation
    const parsed = microAnalysisRequestSchema.safeParse(request);
    if (!parsed.success) {
        logger.error("Micro analysis validation failed:", parsed.error.issues);
        return { success: false, error: "Invalid input data", isGuest: true, remainingCredits: 0 };
    }

    const apiKey = GEMINI_API_KEY_ENV;
    if (!apiKey) {
        return { success: false, error: "API Key not found", isGuest: true, remainingCredits: 0 };
    }

    const isGuest = await isGuestUser();
    let remainingCredits = 0;

    // Verify Turnstile token for bot protection (guests only)
    if (isGuest) {
        const turnstileValid = await verifyTurnstileToken(request.turnstileToken);
        if (!turnstileValid) {
            return { success: false, error: "Bot verification failed. Please try again.", isGuest: true, remainingCredits: 0 };
        }
    }

    // Check and consume credits (same logic as performGuestAnalysis)
    if (isGuest) {
        const creditResult = await useGuestCredit();
        if (!creditResult.success) {
            return {
                success: false,
                error: "GUEST_CREDITS_INSUFFICIENT",
                isGuest: true,
                remainingCredits: creditResult.remainingCredits
            };
        }
        remainingCredits = creditResult.remainingCredits;
    } else {
        const supabase = await createServerClient();
        const user = await getUser();

        if (!user) {
            return { success: false, error: "AUTH_REQUIRED", isGuest: false, remainingCredits: 0 };
        }

        const status = await refreshAnalysisStatus(user.id);
        if (!status) {
            return { success: false, error: "PROFILE_NOT_FOUND", isGuest: false, remainingCredits: 0 };
        }

        const limit = status.is_premium ? PREMIUM_WEEKLY_ANALYSIS_LIMIT : FREE_WEEKLY_ANALYSIS_LIMIT;

        // Atomically check limit and increment weekly usage count
        const { data: newCount, error: rpcError } = await supabase.rpc('increment_weekly_count', {
            p_user_id: user.id, p_limit: limit
        });

        if (rpcError || newCount === -1) {
            const weeklyCount = status.weekly_analysis_count || 0;
            return {
                success: false,
                error: status.is_premium
                    ? `週間制限に達しました (${weeklyCount}/${limit})。月曜日にリセットされます。`
                    : `無料プランの週間制限に達しました。プレミアムプランで週20回まで分析できます！`,
                isGuest: false,
                remainingCredits: 0
            };
        }

        remainingCredits = limit - (newCount ?? 0);
    }

    const lang = request.language || 'ja';

    try {
        // Fetch match context if available
        const version = await fetchLatestVersion();
        let matchContextStr = "";
        let myChampName = "Unknown";
        let truthEvents: Array<{ type: string; timestamp: number; [key: string]: unknown }> = [];
        let champAttrs: Awaited<ReturnType<typeof getChampionAttributes>> = null;

        if (request.matchId && request.puuid) {
            const [matchRes, timelineRes] = await Promise.all([
                fetchMatchDetail(request.matchId),
                fetchMatchTimeline(request.matchId)
            ]);

            if (matchRes.success && matchRes.data) {
                const parts = matchRes.data.info.participants;
                const me = parts.find((p: MatchV5Participant) => p.puuid === request.puuid);
                const myTeamId = me ? me.teamId : 0;
                if (me) {
                    myChampName = me.championName;
                    champAttrs = await getChampionAttributes(me.championName);
                }
                const allies = parts.filter((p: MatchV5Participant) => p.teamId === myTeamId).map((p: MatchV5Participant) => `${p.championName} (${p.teamPosition})`);
                const enemies = parts.filter((p: MatchV5Participant) => p.teamId !== myTeamId).map((p: MatchV5Participant) => `${p.championName} (${p.teamPosition})`);

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

            if (timelineRes.success && timelineRes.data) {
                const allEvents = await extractMatchEvents(timelineRes.data, request.puuid);
                truthEvents = allEvents.filter(e => e.type === 'KILL' || e.type === 'OBJECTIVE');
            }
        }

        // Build micro analysis prompt
        const langInstructions: Record<string, string> = {
            ja: '**重要**: 以下のJSONフィールドは全て日本語で出力してください: summary, mistakes[].title, mistakes[].advice, finalAdvice, tradeAnalysis.reason, tradeAnalysis.optimalAction, tradeAnalysis.cooldownContext, skillsUsed[].note, mechanicsEvaluation.comboExecution, mechanicsEvaluation.positioningNote, improvements[].title, improvements[].currentBehavior, improvements[].idealBehavior, improvements[].practice, championContext.playstyleAdvice, championContext.keyCombo, environment内の説明文。\nenumの値(WIN/LOSE, HIGH/MEDIUM/LOW, PERFECT/GOODなど)は英語のままにしてください。',
            en: '**IMPORTANT**: Output ALL text fields in English: summary, mistakes[].title, mistakes[].advice, finalAdvice, tradeAnalysis.reason, tradeAnalysis.optimalAction, tradeAnalysis.cooldownContext, skillsUsed[].note, mechanicsEvaluation.comboExecution, mechanicsEvaluation.positioningNote, improvements[].title, improvements[].currentBehavior, improvements[].idealBehavior, improvements[].practice, championContext.playstyleAdvice, championContext.keyCombo, environment descriptions.\nKeep enum values (WIN/LOSE, HIGH/MEDIUM/LOW, PERFECT/GOOD, etc.) in English.',
            ko: '**중요**: 다음 JSON 필드는 모두 한국어로 출력하세요: summary, mistakes[].title, mistakes[].advice, finalAdvice, tradeAnalysis.reason, tradeAnalysis.optimalAction, tradeAnalysis.cooldownContext, skillsUsed[].note, mechanicsEvaluation.comboExecution, mechanicsEvaluation.positioningNote, improvements[].title, improvements[].currentBehavior, improvements[].idealBehavior, improvements[].practice, championContext.playstyleAdvice, championContext.keyCombo, environment 설명문.\nenum 값(WIN/LOSE, HIGH/MEDIUM/LOW, PERFECT/GOOD 등)은 영어로 유지하세요.'
        };

        let relevantTruthEvents = truthEvents;
        if (request.analysisStartGameTime !== undefined && request.analysisEndGameTime !== undefined) {
            const startMs = request.analysisStartGameTime * 1000;
            const endMs = request.analysisEndGameTime * 1000;
            relevantTruthEvents = truthEvents.filter((e) =>
                e.timestamp >= startMs && e.timestamp <= endMs
            );
        }

        const champClass = champAttrs?.class || 'Unknown';
        let classSpecificPrompt = '';
        if (champClass === 'Assassin') classSpecificPrompt = '- Did they look for opportunities to burst squishies?\n- Did they manage their escape/engage cooldowns?';
        else if (champClass === 'Marksman' || champClass === 'ADC') classSpecificPrompt = '- Are they kiting properly (attack-move)?\n- Are they maintaining safe distance while dealing damage?';
        else if (champClass === 'Mage') classSpecificPrompt = '- Are they spacing correctly for their range?\n- Are they using abilities at optimal range?';
        else if (champClass === 'Fighter' || champClass === 'Bruiser') classSpecificPrompt = '- Are they managing their sustained damage correctly?\n- Are they using defensive abilities at the right time?';
        else if (champClass === 'Tank') classSpecificPrompt = '- Are they absorbing damage for carries?\n- Are they using CC at optimal times?';
        else if (champClass === 'Support') classSpecificPrompt = '- Are they protecting their carry?\n- Are they landing key CC abilities?';

        const promptText = `
You are an elite League of Legends micro-mechanics coach specializing in mechanical skill analysis, combat execution, and in-the-moment decision making.

${langInstructions[lang] || langInstructions.ja}

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
   - Class: ${champClass}
   - Identity: ${champAttrs?.identity || 'Unknown'}
   - For ${champClass}, evaluate their role-specific execution:
     ${classSpecificPrompt}

5. **SKILL LEVEL ASSESSMENT**: Based on the observed mechanics, estimate if the player is:
   - BEGINNER: Missing basic mechanics, needs fundamentals
   - INTERMEDIATE: Has basics but inconsistent execution
   - ADVANCED: Good mechanics but needs optimization

**Current LoL Version: ${version}**

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
            "role": "${champClass}",
            "playstyleAdvice": "General advice for this champion/role",
            "keyCombo": "The key combo to master for this champion"
        },
        "skillLevel": "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
        "overallGrade": "S" | "A" | "B" | "C" | "D"
    }
}
`;

        // Multi-model fallback with geminiRetry
        const modelsToTry = GEMINI_MODELS_TO_TRY;
        const errors: string[] = [];
        let analysisData: VisionAnalysisResult | null = null;

        for (const modelName of modelsToTry) {
            try {
                const genAI = getGeminiClient(apiKey);
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: {
                        responseMimeType: "application/json",
                        temperature: 0.0,
                        maxOutputTokens: 8192
                    }
                });

                const parts: (string | { inlineData: { data: string; mimeType: string } })[] = [promptText];
                const MAX_FRAMES = 30;
                const framesToProcess = request.frames.slice(0, MAX_FRAMES);

                framesToProcess.forEach((frame) => {
                    const matches = frame.match(/^data:(.+);base64,(.+)$/);
                    if (matches && matches.length === 3) {
                        parts.push({
                            inlineData: { data: matches[2], mimeType: matches[1] }
                        });
                    }
                });

                if (parts.length <= 1) throw new Error("No frames provided");

                const result = await geminiRetry(
                    () => model.generateContent(parts),
                    { maxRetries: 3, label: 'GuestMicro' }
                );
                const rawText = result.response.text();
                const text = rawText.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");

                if (text.length > 100 * 1024) {
                    throw new Error(`Response too large (${Math.round(text.length / 1024)}KB)`);
                }

                const trimmedText = text.trim();
                if (!trimmedText.endsWith('}')) {
                    throw new Error(`Response truncated (${text.length} chars)`);
                }

                analysisData = JSON.parse(text) as VisionAnalysisResult;

                // Time sync
                const parsedData = analysisData as VisionAnalysisResult & { initialGameTime?: string };
                if (parsedData.initialGameTime) {
                    const initTimeStr = parsedData.initialGameTime;
                    const [m, s] = initTimeStr.split(':').map(Number);
                    if (!isNaN(m) && !isNaN(s)) {
                        analysisData.timeOffset = -(m * 60 + s);
                    }
                }

                break; // Success
            } catch (e) {
                logger.warn(`[GuestMicro] Error ${modelName}: model call failed`);
                errors.push(modelName);
                continue; // Next model
            }
        }

        if (!analysisData) {
            throw new Error("All models failed for guest micro analysis");
        }

        return {
            success: true,
            result: analysisData,
            isGuest,
            remainingCredits
        };

    } catch (error) {
        logger.error("[performGuestMicroAnalysis] Analysis failed");
        return {
            success: false,
            error: "ANALYSIS_FAILED",
            isGuest,
            remainingCredits
        };
    }
}
