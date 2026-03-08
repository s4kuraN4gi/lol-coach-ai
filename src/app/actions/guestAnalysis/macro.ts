"use server";

import { getGeminiClient, GEMINI_MODELS_TO_TRY } from "@/lib/gemini";
import { createClient as createServerClient, getUser } from "@/utils/supabase/server";
import { getGuestCreditStatus, useGuestCredit, isGuestUser } from "../guestCredits";
import { refreshAnalysisStatus } from "../analysis";
import { FREE_WEEKLY_ANALYSIS_LIMIT, PREMIUM_WEEKLY_ANALYSIS_LIMIT, FREE_INTER_SEGMENT_DELAY_MS } from "../constants";
import { GUEST_FIXED_SEGMENTS } from "../guestConstants";
import type { GuestSegment } from "../guestConstants";
import { logger } from "@/lib/logger";
import { geminiRetry } from "@/lib/retry";
import { verifyTurnstileToken } from "@/lib/turnstile";
import {
    type FreeSegmentInfo,
    type GuestAnalysisRequest,
    type GuestAnalysisResult,
    type GuestSegmentAnalysis,
    guestAnalysisRequestSchema,
    GEMINI_API_KEY_ENV,
    generateGuestAnalysisPrompt,
    generateGuestOverallSummary,
} from "./shared";

// Check if user can perform analysis (guest or free member)
export async function canPerformGuestAnalysis(): Promise<{
    canAnalyze: boolean;
    isGuest: boolean;
    credits: number;
    maxCredits: number;
    nextCreditAt: Date | null;
    upgradeMessage?: string;
    isPremium?: boolean;
}> {
    const isGuest = await isGuestUser();

    if (isGuest) {
        const guestStatus = await getGuestCreditStatus();
        return {
            canAnalyze: guestStatus.canUse,
            isGuest: true,
            credits: guestStatus.credits,
            maxCredits: 3,
            nextCreditAt: guestStatus.nextCreditAt,
            upgradeMessage: guestStatus.credits <= 0
                ? "ゲストのクレジットが不足しています。アカウント登録で月3回まで分析できます！"
                : undefined,
            isPremium: false
        };
    } else {
        // Logged in user - check their analysis status
        const status = await refreshAnalysisStatus();
        if (!status) {
            return {
                canAnalyze: false,
                isGuest: false,
                credits: 0,
                maxCredits: 0,
                nextCreditAt: null,
                upgradeMessage: "プロフィールが見つかりません",
                isPremium: false
            };
        }

        // Premium users should be redirected to /dashboard/coach
        if (status.is_premium) {
            return {
                canAnalyze: true,
                isGuest: false,
                credits: PREMIUM_WEEKLY_ANALYSIS_LIMIT,
                maxCredits: PREMIUM_WEEKLY_ANALYSIS_LIMIT,
                nextCreditAt: null,
                isPremium: true
            };
        }

        const weeklyCount = status.weekly_analysis_count || 0;
        const limit = FREE_WEEKLY_ANALYSIS_LIMIT;
        const remaining = Math.max(0, limit - weeklyCount);

        return {
            canAnalyze: remaining > 0,
            isGuest: false,
            credits: remaining,
            maxCredits: limit,
            nextCreditAt: null, // Resets on Monday
            upgradeMessage: remaining <= 0
                ? "無料プランの週間制限に達しました。プレミアムプランで週20回まで分析できます！"
                : undefined,
            isPremium: false
        };
    }
}

// Main analysis function for guests and free members
export async function performGuestAnalysis(
    request: GuestAnalysisRequest
): Promise<GuestAnalysisResult> {
    // Input validation
    const parsed = guestAnalysisRequestSchema.safeParse(request);
    if (!parsed.success) {
        const errorMsg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
        logger.error("Guest analysis validation failed:", errorMsg);
        return {
            success: false,
            analyzedAt: '',
            segments: [],
            overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '' } },
            error: "Invalid input data",
            isGuest: true,
            remainingCredits: 0
        };
    }

    const apiKey = GEMINI_API_KEY_ENV;
    if (!apiKey) {
        return {
            success: false,
            analyzedAt: '',
            segments: [],
            overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '' } },
            error: "API Key not found",
            isGuest: true,
            remainingCredits: 0
        };
    }

    const isGuest = await isGuestUser();

    // Verify Turnstile token for bot protection (guests only)
    if (isGuest) {
        const turnstileValid = await verifyTurnstileToken(request.turnstileToken);
        if (!turnstileValid) {
            return {
                success: false,
                analyzedAt: '',
                segments: [],
                overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '' } },
                error: "Bot verification failed. Please try again.",
                isGuest: true,
                remainingCredits: 0
            };
        }
    }
    let remainingCredits = 0;

    // Check and consume credits
    if (isGuest) {
        const creditResult = await useGuestCredit();
        if (!creditResult.success) {
            return {
                success: false,
                analyzedAt: '',
                segments: [],
                overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '' } },
                error: "GUEST_CREDITS_INSUFFICIENT",
                isGuest: true,
                remainingCredits: creditResult.remainingCredits
            };
        }
        remainingCredits = creditResult.remainingCredits;
    } else {
        // Free/Premium member - use existing system
        const supabase = await createServerClient();
        const user = await getUser();

        if (!user) {
            return {
                success: false,
                analyzedAt: '',
                segments: [],
                overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '' } },
                error: "AUTH_REQUIRED",
                isGuest: false,
                remainingCredits: 0
            };
        }

        const status = await refreshAnalysisStatus(user.id);
        if (!status) {
            return {
                success: false,
                analyzedAt: '',
                segments: [],
                overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '' } },
                error: "PROFILE_NOT_FOUND",
                isGuest: false,
                remainingCredits: 0
            };
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
                analyzedAt: '',
                segments: [],
                overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '' } },
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
        const genAI = getGeminiClient(apiKey);
        const model = genAI.getGenerativeModel({
            model: GEMINI_MODELS_TO_TRY[1],
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.2
            }
        });

        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        const segmentResults: GuestSegmentAnalysis[] = [];
        const segmentErrors: string[] = [];

        // Use provided segments (free member) or fixed segments (guest)
        const segmentsToProcess: (GuestSegment | FreeSegmentInfo)[] =
            request.segments && request.segments.length > 0
                ? request.segments
                : [...GUEST_FIXED_SEGMENTS];

        // Process segments sequentially (rate limiting)
        for (let i = 0; i < segmentsToProcess.length; i++) {
            if (i > 0) {
                await delay(FREE_INTER_SEGMENT_DELAY_MS);
            }

            const segment = segmentsToProcess[i];
            const segmentFrames = request.frames.filter(f => f.segmentId === segment.segmentId);

            if (segmentFrames.length === 0) {
                segmentErrors.push(`Segment ${segment.segmentId}: No frames`);
                continue;
            }

            try {
                const prompt = generateGuestAnalysisPrompt(segment, lang);
                const parts: (string | { inlineData: { data: string; mimeType: string } })[] = [prompt];

                for (const frame of segmentFrames) {
                    const matches = frame.base64Data.match(/^data:(.+);base64,(.+)$/);
                    if (matches && matches.length === 3) {
                        parts.push({
                            inlineData: { data: matches[2], mimeType: matches[1] }
                        });
                    }
                }

                const text = await geminiRetry(
                    () => model.generateContent(parts).then((r) => r.response.text()),
                    { maxRetries: 3, label: 'GuestMacro' }
                );
                const cleanedText = text
                    .replace(/^```json\s*/, "")
                    .replace(/^```\s*/, "")
                    .replace(/\s*```$/, "");

                const analysisData = JSON.parse(cleanedText);

                segmentResults.push({
                    segmentId: segment.segmentId,
                    type: segment.type,
                    timestamp: segment.targetTimestampStr,
                    observation: analysisData.observation,
                    winningPattern: analysisData.winningPattern,
                    improvement: analysisData.improvement
                });
            } catch (segError) {
                const segMsg = segError instanceof Error ? segError.message : String(segError);
                logger.error(`[GuestAnalysis] Segment ${i} error:`, segMsg);
                segmentErrors.push(`Segment ${segment.segmentId}: ${segMsg}`);
            }
        }

        const overallSummary = generateGuestOverallSummary(segmentResults, lang);

        return {
            success: true,
            analyzedAt: new Date().toISOString(),
            segments: segmentResults,
            overallSummary,
            warnings: segmentErrors.length > 0 ? segmentErrors : undefined,
            requestedSegments: segmentsToProcess.length,
            completedSegments: segmentResults.length,
            timeOffset: request.timeOffset,
            isGuest,
            remainingCredits
        };

    } catch (error) {
        logger.error("[performGuestAnalysis] Error:", error);
        return {
            success: false,
            analyzedAt: '',
            segments: [],
            overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '' } },
            error: "ANALYSIS_FAILED",
            isGuest,
            remainingCredits
        };
    }
}
