'use server';

import { createClient } from "@/utils/supabase/server";
import { fetchMatchTimeline } from "./riot";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;

export type CoachingInsight = {
    timestamp: number; // in milliseconds
    timestampStr: string; // e.g. "15:20"
    title: string;
    description: string;
    type: 'MISTAKE' | 'TURNING_POINT' | 'GOOD_PLAY' | 'INFO';
    advice: string;
};

export async function analyzeMatchTimeline(matchId: string, puuid: string, userApiKey?: string): Promise<{ success: boolean, insights?: CoachingInsight[], error?: string }> {
    const apiKeyToUse = userApiKey || GEMINI_API_KEY_ENV;

    if (!apiKeyToUse) {
        return { success: false, error: "API Key Not Found" };
    }

    try {
        // 1. Fetch Timeline
        const timelineRes = await fetchMatchTimeline(matchId);
        if (!timelineRes.success || !timelineRes.data) {
            return { success: false, error: timelineRes.error || "Failed to fetch timeline" };
        }

        const timeline = timelineRes.data;
        const participantId = getParticipantIdFromPuuid(timeline, puuid);

        if (!participantId) {
             return { success: false, error: "Participant not found in timeline" };
        }

        // 2. Filter & Summarize Timeline for Prompt (Reduce Tokens)
        const summary = summarizeTimeline(timeline, participantId);

        // 3. Prompt Gemini
        const genAI = new GoogleGenerativeAI(apiKeyToUse);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });

        const prompt = `
        You are a professional League of Legends Coach.
        Analyze the following match timeline summary for the player (Participant ${participantId}).
        Identify critical moments, mistakes, and turning points.
        
        Focus on:
        1. Deaths (Is it an isolation death? Gank? Teamfight loss?)
        2. Objective fights (Did they participate? Was it successful?)
        3. Item builds (contextual)
        
        Timeline Summary:
        ${JSON.stringify(summary)}

        Output a JSON array of insights. Format:
        [
            {
                "timestamp": number (milliseconds),
                "timestampStr": string (e.g. "12:30"),
                "title": string (Short summary),
                "description": string (What happened),
                "type": "MISTAKE" | "TURNING_POINT" | "GOOD_PLAY" | "INFO",
                "advice": string (Actionable coaching advice)
            }
        ]
        `;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const jsonText = response.text();
        const insights: CoachingInsight[] = JSON.parse(jsonText);

        return { success: true, insights };

    } catch (e: any) {
        console.error("Coaching Analysis Error:", e);
        return { success: false, error: e.message };
    }
}

// Helper: Extract Participant ID
function getParticipantIdFromPuuid(timeline: any, puuid: string): number | null {
    const participants = timeline.info.participants; // Note: Timeline structure varies slightly
    // Actually timeline.info.participants uses 'puuid' in modern API?
    // Let's check typical structure. Usually match V5 timeline has 'participants' in info.
    const p = participants.find((p: any) => p.puuid === puuid);
    return p ? p.participantId : null; 
}

// Helper: Summarize Timeline (Heuristic)
function summarizeTimeline(timeline: any, participantId: number) {
    const events: any[] = [];
    const frames = timeline.info.frames;

    frames.forEach((frame: any) => {
        const relevantEvents = frame.events.filter((e: any) => {
             // Filter for events involving the player or major objectives
             if (e.type === 'CHAMPION_KILL') {
                 return e.killerId === participantId || e.victimId === participantId || e.assistingParticipantIds?.includes(participantId);
             }
             if (e.type === 'ELITE_MONSTER_KILL') return true; // Baron/Dragon
             if (e.type === 'TURRET_PLATE_DESTROYED') return e.killerId === participantId;
             if (e.type === 'BUILDING_KILL') return true; // Turrets
             return false;
        });

        relevantEvents.forEach((e: any) => {
            events.push({
                type: e.type,
                timestamp: e.timestamp,
                details: formatEventDetails(e, participantId)
            });
        });
    });

    return events;
}

function formatEventDetails(e: any, pid: number) {
    if (e.type === 'CHAMPION_KILL') {
        if (e.victimId === pid) return "Player Died";
        if (e.killerId === pid) return "Player got a Kill";
        return "Teamfight / Assist";
    }
    return e.type;
}
