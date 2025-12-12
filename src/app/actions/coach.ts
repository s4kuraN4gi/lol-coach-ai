'use server';

import { createClient } from "@/utils/supabase/server";
import { fetchMatchTimeline, fetchMatchDetail } from "./riot";
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
        // 1. Fetch Data (Timeline + Match Details for Context)
        const [timelineRes, matchRes] = await Promise.all([
            fetchMatchTimeline(matchId),
            fetchMatchDetail(matchId)
        ]);

        if (!timelineRes.success || !timelineRes.data) return { success: false, error: "Failed to fetch timeline" };
        if (!matchRes.success || !matchRes.data) return { success: false, error: "Failed to fetch match details" };

        const timeline = timelineRes.data;
        const match = matchRes.data;

        // 2. Build Match Context (User, Opponent, Runes, Spells)
        const context = getMatchContext(match, puuid);
        if (!context) return { success: false, error: "Participant analysis failed" };

        const { userPart, opponentPart } = context;

        // 3. Summarize Timeline (Filter for User & key objectives)
        const events = summarizeTimeline(timeline, userPart.participantId, opponentPart?.participantId);

        // 4. Prompt Gemini (MACRO FOCUSED)
        const genAI = new GoogleGenerativeAI(apiKeyToUse);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });

        const prompt = `
        You are a generic High-Elo League of Legends Strategic Coach.
        Your goal is to provide MACRO-LEVEL advice.
        
        CRITICAL INSTRUCTION:
        - DO NOT talk about micro mechanics (e.g. "You missed a skillshot", "Dodging").
        - FOCUS on: Wave Management, Power Spikes, Itemization, Objective Control, and Map Awareness.
        - USE THE CONTEXT: You know the matchup (${userPart.championName} vs ${opponentPart ? opponentPart.championName : 'Unknown'}).
        
        CONTEXT:
        - Player Role: ${userPart.teamPosition}
        - Champion: ${userPart.championName} (Level ${userPart.champLevel})
        - KDA: ${userPart.kills}/${userPart.deaths}/${userPart.assists}
        - Key Runes: ${userPart.perks.styles[0].style} / ${userPart.perks.styles[1].style}
        - Summoner Spells: ${userPart.summoner1Id}, ${userPart.summoner2Id} (IDs)
        
        OPPONENT (Lane/Jungle Matchup):
        - Champion: ${opponentPart ? opponentPart.championName : 'None'}
        - Runes: ${opponentPart ? opponentPart.perks.styles[0].style : 'N/A'}
        
        TIMELINE EVENTS (Summary):
        ${JSON.stringify(events)}

        EXAMPLE OUTPUT STYLE (Observe the Macro Focus):
        User is Fiora vs Malphite.
        Event: Death at 14:00.
        Insight: "Your Divine Sunderer power spike was not ready yet, while Malphite had Bramble Vest. Fighting here was statistically a loss. You should have pushed the wave and looked for a roam mid or waited for Sunderer."

        YOUR TASK:
        Analyze the provided timeline events and generate JSON insights.
        Output Format:
        [
            {
                "timestamp": number (ms),
                "timestampStr": string ("mm:ss"),
                "title": string (Short Macro Headline),
                "description": string (Context of what happened),
                "type": "MISTAKE" | "TURNING_POINT" | "GOOD_PLAY" | "INFO",
                "advice": string (Strategic advice based on Matchu/State)
            }
        ]
        `;

        const result = await model.generateContent(prompt);
        const insights: CoachingInsight[] = JSON.parse(result.response.text());

        return { success: true, insights };

    } catch (e: any) {
        console.error("Coaching Analysis Error:", e);
        return { success: false, error: e.message };
    }
}

// Helper: Extract Match Context (User + Opponent + Runes)
function getMatchContext(match: any, puuid: string) {
    const participants = match.info.participants;
    const userPart = participants.find((p: any) => p.puuid === puuid);

    if (!userPart) return null;

    // Find direct opponent (Same position, different team)
    // Note: In some modes (Arena, ARAM), position might be fuzzy, but for SR it works.
    const opponentPart = participants.find((p: any) => 
        p.teamId !== userPart.teamId && 
        p.teamPosition === userPart.teamPosition &&
        p.teamPosition !== '' 
        // Fallback: If position is empty (ARAM), maybe just ignore opponent specific context or pick highest gold enemy?
        // For now strict lane opponent is best for "Macro".
    );

    return { userPart, opponentPart };
}

// Helper: Summarize Timeline (Heuristic with Objectives)
function summarizeTimeline(timeline: any, userId: number, opponentId?: number) {
    const events: any[] = [];
    const frames = timeline.info.frames;

    frames.forEach((frame: any) => {
        const relevantEvents = frame.events.filter((e: any) => {
             // 1. Champion Kill (User or Opponent involved)
             if (e.type === 'CHAMPION_KILL') {
                 // User died, User killed, or Opponent killed (important context)
                 return e.victimId === userId || e.killerId === userId || e.assistingParticipantIds?.includes(userId) ||
                        (opponentId && (e.killerId === opponentId || e.victimId === opponentId));
             }
             // 2. Objectives (Dragon, Baron, Rift Herald) - GLOBAL relevance
             if (e.type === 'ELITE_MONSTER_KILL') return true; 
             
             // 3. Turrets (User taking or User losing)
             if (e.type === 'BUILDING_KILL') {
                 return e.killerId === userId || (e.teamId !== 0 && e.teamId === getTeamIdFromPid(userId, timeline) ); 
                 // Note: getting TeamID from PID in timeline is tricky without context, but we can infer.
                 // Actually easier: Just log all building kills, they are macro events.
                 return true;
             }
             
             // 4. Item Purchase (Crucial for Power Spikes)
             if (e.type === 'ITEM_PURCHASED') {
                 return e.participantId === userId || (opponentId && e.participantId === opponentId);
             }

             return false;
        });

        relevantEvents.forEach((e: any) => {
            // Simplify Item events to reduce tokens (only legendary/mythic? or just all for now)
            // Filtering very cheap items might be good optimization later.
            
            events.push({
                type: e.type,
                timestamp: e.timestamp,
                details: formatEventDetails(e, userId, opponentId)
            });
        });
    });

    return events;
}

function formatEventDetails(e: any, uid: number, oid?: number) {
    if (e.type === 'CHAMPION_KILL') {
        if (e.victimId === uid) return `User DIED (Killer: ${e.killerId})`;
        if (e.killerId === uid) return `User KILLED (Victim: ${e.victimId})`;
        if (oid && e.killerId === oid) return `Opponent KILLED someone`;
        if (oid && e.victimId === oid) return `Opponent DIED`;
        return `Teamfight (User Assist)`;
    }
    if (e.type === 'ITEM_PURCHASED') {
        return `${e.participantId === uid ? "User" : "Opponent"} bought Item ${e.itemId}`;
    }
    if (e.type === 'ELITE_MONSTER_KILL') {
        return `${e.monsterType} taken by Killer ${e.killerId}`;
    }
    return e.type;
}

function getTeamIdFromPid(pid: number, timeline: any) {
    // In standard timeline, pids 1-5 are Team 100, 6-10 are Team 200.
    return pid <= 5 ? 100 : 200;
}
