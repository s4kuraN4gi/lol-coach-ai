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

// --- Icons & Helpers ---

const getDragonName = (subtype?: string) => {
    switch(subtype) {
        case "CHEMTECH_DRAGON": return "Chemtech Dragon";
        case "CLOUD_DRAGON": 
        case "AIR_DRAGON": return "Cloud Dragon";
        case "HEX_DRAGON": 
        case "HEXTECH_DRAGON": return "Hextech Dragon";
        case "FIRE_DRAGON": 
        case "INFERNAL_DRAGON": return "Infernal Dragon";
        case "EARTH_DRAGON": 
        case "MOUNTAIN_DRAGON": return "Mountain Dragon";
        case "WATER_DRAGON": 
        case "OCEAN_DRAGON": return "Ocean Dragon";
        case "ELDER_DRAGON": return "Elder Dragon";
        default: return subtype || "Dragon";
    }
};

const ObjectiveIcon = ({ type, subtype }: { type: string, subtype?: string }) => {
    // Icons are simple SVG paths
    if (type === "BUILDING_KILL") {
        // Tower / Rooks
        return (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="drop-shadow-sm">
                <path d="M12 2L4 6V10C4 16 7 20 12 22C17 20 20 16 20 10V6L12 2ZM6 7L12 4L18 7V10C18 14.5 15.8 17.8 12 19.5C8.2 17.8 6 14.5 6 10V7Z" />
                <path d="M9 10H15M12 7V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
        );
    }
    if (type === "ELITE_MONSTER_KILL") {
        if (subtype === "BARON_NASHOR") {
            // Skull / Baron
            return (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="drop-shadow-sm">
                    <path d="M12 2C7 2 3 6 3 11C3 16 7 20 12 20C17 20 21 16 21 11C21 6 17 2 12 2ZM9 9C9.8 9 10.5 9.7 10.5 10.5C10.5 11.3 9.8 12 9 12C8.2 12 7.5 11.3 7.5 10.5C7.5 9.7 8.2 9 9 9ZM15 9C15.8 9 16.5 9.7 16.5 10.5C16.5 11.3 15.8 12 15 12C14.2 12 13.5 11.3 13.5 10.5C13.5 9.7 14.2 9 15 9ZM12 18C10 18 8 16.5 8 16.5H16C16 16.5 14 18 12 18Z" />
                </svg>
            );
        }
        if (subtype === "RIFTHERALD") {
            // Eye / Herald
            return (
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="drop-shadow-sm">
                     <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM12 6C10.9 6 10 6.9 10 8C10 9.1 10.9 10 12 10C13.1 10 14 9.1 14 8C14 6.9 13.1 6 12 6ZM12 13C9.33 13 7 14.33 7 17H17C17 14.33 14.67 13 12 13Z" />
                 </svg>
            );
        }
        if (subtype === "HORDE") {
             // Grub / Dot
             return (
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="drop-shadow-sm">
                     <circle cx="12" cy="12" r="10" />
                 </svg>
             );
        }
        // Dragons
        return (
             <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="drop-shadow-sm">
                 <path d="M12 2L15 8L21 9L16 14L18 20L12 17L6 20L8 14L3 9L9 8L12 2Z" /> {/* Star shape as Generic Dragon for now ? No, user wants better. */}
                 {/* Let's use a simpler Wing-like shape */}
                 <path d="M20 12C20 7.58 16.42 4 12 4C7.58 4 4 7.58 4 12C4 16.42 7.58 20 12 20C12.5 20 13 19.95 13.5 19.86V19.85C16.8 19.08 19.38 16.32 19.94 12.86C19.98 12.58 20 12.29 20 12Z" opacity="0.4"/>
                 <path d="M12 2C10.5 2 9 2.5 8 3.5C9 3.5 10 4 10.5 5C9 5.5 8 6.5 7.5 7.5C9 7.5 10 8.5 10 10C8 10 6.5 11 6 12C7.5 12 8.5 13 9 14.5C8 15.5 7 17 6.5 18C8 17.5 9.5 17 10.5 16C10 17 10 18.5 10.5 19.5C12 18.5 13 17 13.5 15.5C14.5 16 16 16 17 15.5C16.5 14 15.5 13 14.5 12.5C15.5 11.5 16 10 16 8.5C14.5 9 13 9 12.5 10C12.5 8 13.5 6.5 15 5.5C13.5 5 12.5 3.5 12 2Z" />
             </svg>
        );
    }
    return <div className="text-[10px]">⚔️</div>;
}


// --- Component ---

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

    // Max diff for scaling (Gold)
    const maxDiff = Math.max(...goldDiffData.map(d => Math.abs(d.diff)), 2000);

    // Calculate Active Vision (Sliding Window of ~3 mins for Wards)
    const activeVisionData = useMemo(() => {
        const WARD_LIFESPAN = 180000; // 3 mins in ms
        
        // Extract all ward events first for O(1) access? No, filter is fast enough for ~1000 events.
        const wardEvents = timeline.info.frames.flatMap(f => f.events.filter(e => e.type === "WARD_PLACED"));

        return timeline.info.frames.map(frame => {
            const now = frame.timestamp;
            const start = now - WARD_LIFESPAN;
            
            // Count wards placed in the last 3 minutes
            // Note: This is an estimation. Real logic requires tracking individual ward deaths.
            // But "Recent Placement Frequency" is a good proxy for "Active Vision Control".
            const activeWards = wardEvents.filter(e => e.timestamp > start && e.timestamp <= now);
            
            let blue = 0;
            let red = 0;
            
            activeWards.forEach(e => {
                 const p = match.info.participants.find((p: any) => p.participantId === e.creatorId);
                 if (p?.teamId === 100) blue++;
                 else if (p?.teamId === 200) red++;
            });
            
            // Cap at reasonable max (e.g., 25 wards implies ~100% map control)
            // Using 4% per ward
            return { 
                blue: Math.min(100, blue * 4), 
                red: Math.min(100, red * 4) 
            };
        });
    }, [timeline, match]);
    
    const visionGraphData = activeVisionData; 

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

    return (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden relative group/timeline">
            {/* Control Bar */}
            <div className="bg-slate-800/50 p-4 flex justify-between items-center border-b border-slate-700">
                 <h2 className="text-white font-bold flex items-center gap-2">
                    <span>🎞️</span> MATCH TIMELINE
                 </h2>
                 
                 <div className="flex items-center gap-4">
                     <div className="text-xs text-slate-400 font-mono">
                         Duration: {formatTime(duration)}
                     </div>
                 </div>
            </div>

            {/* Visualizer Area */}
            {/* Added py-6 to prevent vertical marker cutoff, removed overflow-hidden */}
            <div className="relative h-72 w-full bg-slate-950 py-6">
                
                {/* Vision Percentage Overlays (Bottom Left/Right) */}
                {/* Show current hovered frame data, else 0 or last frame? Show 0 if not hovered to be clean. */}
                <div className={`absolute bottom-2 left-4 z-30 transition-opacity duration-300 ${hoveredFrame !== null ? 'opacity-100' : 'opacity-50'}`}>
                    <div className="flex flex-col items-start bg-slate-900/50 p-2 rounded backdrop-blur-sm border border-slate-800/50">
                        <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Blue Vision</span>
                        <div className="text-2xl font-black text-blue-500 drop-shadow-lg tabular-nums">
                            {hoveredFrame !== null ? visionGraphData[hoveredFrame].blue : 0}%
                        </div>
                    </div>
                </div>
                <div className={`absolute bottom-2 right-4 z-30 transition-opacity duration-300 ${hoveredFrame !== null ? 'opacity-100' : 'opacity-50'}`}>
                     <div className="flex flex-col items-end bg-slate-900/50 p-2 rounded backdrop-blur-sm border border-slate-800/50">
                        <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Red Vision</span>
                        <div className="text-2xl font-black text-red-500 drop-shadow-lg tabular-nums">
                            {hoveredFrame !== null ? visionGraphData[hoveredFrame].red : 0}%
                        </div>
                    </div>
                </div>


                {/* SVG Container */}
                <svg 
                    width="100%" 
                    height="100%" 
                    viewBox={`0 0 ${goldDiffData.length} 100`}
                    preserveAspectRatio="none"
                    className="absolute inset-0 top-6 bottom-6 h-[calc(100%-3rem)]" /* Match py-6 padding */
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
                                // Reduced scale factor from 45 to 35 to prevent peak cutoff
                                const y = 50 - (clampedPercent * 35); 
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

                {/* Objective Markers Overlay (Always Show) */}
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
                    
                    // Determine Type Name for Tooltip
                    let typeName = "";
                    if (obj.type === "BUILDING_KILL") {
                        typeName = obj.towerType ? `Turret (${obj.laneType})` : "Inhibitor";
                    } else if (obj.monsterType === "DRAGON") {
                        typeName = getDragonName(obj.monsterSubType);
                    } else if (obj.monsterType === "BARON_NASHOR") {
                        typeName = "Baron Nashor";
                    } else if (obj.monsterType === "RIFTHERALD") {
                        typeName = "Rift Herald";
                    } else if (obj.monsterType === "HORDE") {
                        typeName = "Voidgrubs";
                    } else {
                        typeName = "Objective";
                    }

                    // Positioning
                    const isBuilding = obj.type === "BUILDING_KILL";
                    
                    return (
                        <div 
                            key={i} 
                            className={`absolute flex flex-col items-center transform -translate-x-1/2 cursor-help z-10 hover:z-20 group/marker transition-all duration-300 hover:scale-125 ${colorClass}`}
                            style={{ 
                                left: `${(obj.frameIndex / goldDiffData.length) * 100}%`,
                                top: isBuilding ? (isBlue ? "20%" : "80%") : (isBlue ? "45%" : "55%") // Monsters closer to center
                            }}
                        >
                            <ObjectiveIcon type={obj.type} subtype={obj.monsterType === "DRAGON" ? obj.monsterSubType : obj.monsterType} />
                            
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 bg-slate-900/95 text-white text-[10px] p-2 rounded whitespace-nowrap opacity-0 group-hover/marker:opacity-100 pointer-events-none border border-slate-700 z-50 shadow-xl backdrop-blur-sm">
                                <div className="font-bold mb-0.5">{typeName}</div>
                                <div className="text-slate-400 flex items-center gap-1">
                                    <span>{formatTime(obj.timestamp)}</span>
                                    <span>•</span>
                                    <span className={isBlue ? "text-blue-300" : "text-red-300"}>
                                        {isBlue ? "Blue Team" : "Red Team"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                })}

                {/* Mouse Hover Line */}
                <div 
                    className="absolute inset-0 opacity-0 group-hover/timeline:opacity-100 transition-opacity duration-200 z-0"
                    onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        // Adjust for padding? No, events relative to full width
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
                        <div className="flex items-center gap-4">
                            <span>⏱ {formatTime(goldDiffData[hoveredFrame].timestamp)}</span>
                             <span className={goldDiffData[hoveredFrame].diff > 0 ? "text-blue-400" : "text-red-400"}>
                                 Gold Diff: {goldDiffData[hoveredFrame].diff > 0 ? "+" : ""}{goldDiffData[hoveredFrame].diff}
                             </span>
                        </div>
                    </>
                ) : (
                    <div className="text-slate-500 w-full text-center">
                        Hover chart to view gold difference and vision stats
                    </div>
                )}
            </div>
        </div>
    );
}


