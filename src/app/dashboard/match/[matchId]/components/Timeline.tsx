"use client";

import React, { useState, useMemo } from 'react';

// Types for Riot Timeline DTO (Simplified)
type TimelineFrame = {
    timestamp: number;
    events: TimelineEvent[];
    participantFrames: Record<string, ParticipantFrame>;
}

type TimelineEvent = {
    type: string;
    timestamp: number;
    participantId?: number;
    itemId?: number;
    skillSlot?: number;
    levelUpType?: string;
    wardType?: string;
    creatorId?: number;
    killerId?: number;
    victimId?: number;
    assistingParticipantIds?: number[];
    teamId?: number;
    buildingType?: string;
    laneType?: string;
    towerType?: string;
    monsterType?: string;
    monsterSubType?: string;
}

type ParticipantFrame = {
    participantId: number;
    position: { x: number, y: number };
    currentGold: number;
    totalGold: number;
    level: number;
    xp: number;
    minionsKilled: number;
    jungleMinionsKilled: number;
    damageStats: {
        totalDamageDoneToChampions: number;
        magicDamageDoneToChampions: number;
        physicalDamageDoneToChampions: number;
        trueDamageDoneToChampions: number;
    }
}

type TimelineDTO = {
    metadata: {
        dataVersion: string;
        matchId: string;
        participants: string[];
    };
    info: {
        frameInterval: number;
        frames: TimelineFrame[];
    };
}

export default function Timeline({ match, timeline }: { match: any, timeline: TimelineDTO }) {
    const [hoveredFrame, setHoveredFrame] = useState<number | null>(null);

    // Calculate Game Duration from last frame timestamp
    const duration = timeline.info.frames[timeline.info.frames.length - 1].timestamp;

    // Helper to format time
    const formatTime = (ms: number) => {
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Calculate Gold Diff per frame
    // We need to know which participants belong to Team 100 (Blue) vs 200 (Red)
    // match.info.participants has teamId
    const team100Ids = match.info.participants.filter((p: any) => p.teamId === 100).map((p: any) => p.participantId);
    
    const goldDiffData = useMemo(() => {
        return timeline.info.frames.map(frame => {
            let blueGold = 0;
            let redGold = 0;

            Object.values(frame.participantFrames).forEach(pf => {
                if(team100Ids.includes(pf.participantId)) {
                    blueGold += pf.totalGold;
                } else {
                    redGold += pf.totalGold;
                }
            });

            return {
                timestamp: frame.timestamp,
                diff: blueGold - redGold, // Positive = Blue Lead, Negative = Red Lead
                blueGold,
                redGold
            };
        });
    }, [timeline, team100Ids]);

    // Max diff for scaling
    const maxDiff = Math.max(...goldDiffData.map(d => Math.abs(d.diff)), 1000); // Min 1000 to avoid flatline

    return (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            {/* Control Bar (Optional) */}
            <div className="bg-slate-800/50 p-4 flex justify-between items-center border-b border-slate-700">
                 <h2 className="text-white font-bold flex items-center gap-2">
                    <span>🎞️</span> MATCH TIMELINE
                 </h2>
                 <div className="text-xs text-slate-400 font-mono">
                     Duration: {formatTime(duration)}
                 </div>
            </div>

            {/* Visualizer Area */}
            <div className="relative h-64 w-full bg-slate-950 overflow-x-auto overflow-y-hidden custom-scrollbar">
                {/* SVG Container */}
                <svg 
                    width="100%" 
                    height="100%" 
                    viewBox={`0 0 ${goldDiffData.length} 100`}
                    preserveAspectRatio="none"
                    className="absolute inset-0"
                >
                    {/* Zero Line */}
                    <line x1="0" y1="50" x2={goldDiffData.length} y2="50" stroke="#334155" strokeWidth="0.5" strokeDasharray="2" />

                    {/* Gold Difference Path */}
                    <path 
                        d={`
                            M 0 50
                            ${goldDiffData.map((d, i) => {
                                // Y scale: 0 = +Max, 50 = 0, 100 = -Max
                                // Normalized (-1 to 1) -> (0 to 100)
                                // value = d.diff
                                // percent = value / maxDiff 
                                // y = 50 - (percent * 50)
                                const percent = d.diff / maxDiff;
                                const y = 50 - (percent * 45); // Use 45 to keep padding
                                return `L ${i} ${y}`;
                            }).join(' ')}
                            L ${goldDiffData.length} 50
                            Z
                        `}
                        fill="url(#goldGradient)"
                        fillOpacity="0.4"
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth="0.2"
                    />

                    {/* Gradient Definition */}
                    <defs>
                        <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" /> {/* Blue Lead */}
                            <stop offset="50%" stopColor="#3b82f6" stopOpacity="0" />
                            <stop offset="50%" stopColor="#ef4444" stopOpacity="0" />
                            <stop offset="100%" stopColor="#ef4444" /> {/* Red Lead */}
                        </linearGradient>
                    </defs>
                </svg>

                {/* Event Markers Overlay */}
                {/* Just sample markers for now */}
                {timeline.info.frames.map((frame, i) => {
                    // Extract kills
                    const kills = frame.events.filter(e => e.type === "CHAMPION_KILL");
                    if(kills.length === 0) return null;

                    // Group by frame index (X position)
                    return (
                        <div 
                            key={i} 
                            className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
                            style={{ left: `${(i / goldDiffData.length) * 100}%` }}
                        >
                            <div className="w-0.5 h-full bg-white/10 absolute top-0 bottom-0" />
                            <div className="text-[8px] mb-1">⚔️</div>
                        </div>
                    )
                })}

                {/* AI Markers (Demo) */}
                {/* Will be real later */}
                <div 
                    className="absolute top-4 left-[30%] cursor-pointer group"
                    onClick={() => alert("AI Analysis: Blue Team caught out in jungle!")}
                >
                    <div className="text-xl animate-pulse group-hover:scale-125 transition">✨</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] p-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none">
                        Turning Point
                    </div>
                </div>

            </div>

            {/* Hover Info Panel */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/50 min-h-[100px] flex items-center justify-center text-slate-500 italic">
                {hoveredFrame !== null ? (
                    <div>Time: {formatTime(timeline.info.frames[hoveredFrame].timestamp)} - Gold Diff: {goldDiffData[hoveredFrame].diff}</div>
                ) : (
                    "Click or Hover timeline to see details"
                )}
            </div>
        </div>
    );
}
