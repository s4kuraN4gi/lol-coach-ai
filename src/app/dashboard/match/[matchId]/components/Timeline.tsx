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
    killerTeamId?: number; // Sometimes present in elite monster kills
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
    const maxDiff = Math.max(...goldDiffData.map(d => Math.abs(d.diff)), 2000); 

    // Extract Objectives
    const objectives = useMemo(() => {
        return timeline.info.frames.flatMap((frame, i) => 
            frame.events
                .filter(e => e.type === "ELITE_MONSTER_KILL" || e.type === "BUILDING_KILL")
                .map(e => ({
                    ...e,
                    frameIndex: i
                }))
        );
    }, [timeline]);

    const getObjectiveIcon = (e: TimelineEvent) => {
        if (e.type === "BUILDING_KILL") return "🏯";
        if (e.monsterType === "BARON_NASHOR") return "👾";
        if (e.monsterType === "RIFTHERALD") return "🐞";
        if (e.monsterType === "DRAGON") return "🐉";
        if (e.monsterType === "HORDE") return "🐌"; // Voidgrubs (check actual API name, usually HORDE or similar in new patches, simplified to grub icon for now)
        return "⚔️";
    };

    return (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden relative group/timeline">
            {/* Control Bar */}
            <div className="bg-slate-800/50 p-4 flex justify-between items-center border-b border-slate-700">
                 <h2 className="text-white font-bold flex items-center gap-2">
                    <span>🎞️</span> MATCH TIMELINE
                 </h2>
                 <div className="text-xs text-slate-400 font-mono">
                     Duration: {formatTime(duration)}
                 </div>
            </div>

            {/* Visualizer Area */}
            <div className="relative h-64 w-full bg-slate-950 overflow-hidden">
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
                                const percent = d.diff / maxDiff;
                                const clampedPercent = Math.max(-1, Math.min(1, percent));
                                const y = 50 - (clampedPercent * 45); 
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

                    <defs>
                        <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" /> {/* Blue Lead */}
                            <stop offset="50%" stopColor="#3b82f6" stopOpacity="0" />
                            <stop offset="50%" stopColor="#ef4444" stopOpacity="0" />
                            <stop offset="100%" stopColor="#ef4444" /> {/* Red Lead */}
                        </linearGradient>
                    </defs>
                </svg>

                {/* Objective Markers Overlay */}
                {objectives.map((obj, i) => {
                    // Try to determine team color
                    let teamId = obj.killerTeamId;
                    if (!teamId && obj.killerId) {
                         const killer = match.info.participants.find((p: any) => p.participantId === obj.killerId);
                         teamId = killer?.teamId;
                    }
                    if (!teamId && obj.teamId) teamId = obj.teamId; // For buildings

                    const isBlue = teamId === 100;
                    const colorClass = isBlue ? "text-blue-400" : "text-red-400";
                    const isBuilding = obj.type === "BUILDING_KILL";
                    
                    // Stagger height slightly to avoid complete overlap if close
                    const topOffset = isBuilding ? "10%" : "80%"; 

                    return (
                        <div 
                            key={i} 
                            className={`absolute flex flex-col items-center transform -translate-x-1/2 cursor-help z-10 hover:z-20 group/marker transition-all duration-300 hover:scale-150 ${colorClass}`}
                            style={{ 
                                left: `${(obj.frameIndex / goldDiffData.length) * 100}%`,
                                top: topOffset
                            }}
                        >
                            <div className="text-[12px] drop-shadow-md filter">{getObjectiveIcon(obj)}</div>
                            
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 bg-black/90 text-white text-[10px] p-2 rounded whitespace-nowrap opacity-0 group-hover/marker:opacity-100 pointer-events-none border border-slate-700 z-50">
                                {formatTime(obj.timestamp)} - {obj.monsterType || obj.towerType || "Object"}
                                <div className={`text-[9px] ${isBlue ? 'text-blue-300' : 'text-red-300'}`}>
                                    {isBlue ? "Blue Team" : "Red Team"}
                                </div>
                            </div>
                        </div>
                    )
                })}

                {/* Mouse Hover Line */}
                <div 
                    className="absolute inset-0 opacity-0 group-hover/timeline:opacity-100 transition-opacity duration-200"
                    onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const percent = x / rect.width;
                        const frameIndex = Math.min(goldDiffData.length - 1, Math.floor(percent * goldDiffData.length));
                        setHoveredFrame(frameIndex);
                    }}
                    onMouseLeave={() => setHoveredFrame(null)}
                >
                     {hoveredFrame !== null && (
                        <div 
                            className="absolute top-0 bottom-0 w-px bg-white/20 pointer-events-none"
                            style={{ left: `${(hoveredFrame / goldDiffData.length) * 100}%` }}
                        />
                     )}
                </div>

            </div>

            {/* Hover Info Panel */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-300 font-mono">
                {hoveredFrame !== null ? (
                    <>
                        <div>⏱ {formatTime(goldDiffData[hoveredFrame].timestamp)}</div>
                        <div className={goldDiffData[hoveredFrame].diff > 0 ? "text-blue-400" : "text-red-400"}>
                            Gold Diff: {goldDiffData[hoveredFrame].diff > 0 ? "+" : ""}{goldDiffData[hoveredFrame].diff}
                        </div>
                    </>
                ) : (
                    <div className="text-slate-500 w-full text-center">Hover chart to view gold difference</div>
                )}
            </div>
        </div>
    );
}

