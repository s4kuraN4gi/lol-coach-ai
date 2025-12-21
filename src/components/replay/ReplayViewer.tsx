"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { ReplayData } from "@/app/actions/replay";

type ReplayViewerProps = {
    data: ReplayData;
};

// Map Constants for Summoner's Rift (Approximate Linear Mapping)
// Game Coords: Bottom-Left (0,0) to Top-Right (15000, 15000)
// Web Coords: Top-Left (0,0) to Bottom-Right (100%, 100%)
// Transform:
// x_web = (x_game / 15000) * 100
// y_web = (1 - (y_game / 15000)) * 100

const MAX_COORD = 14820; // More precise edge

export default function ReplayViewer({ data }: ReplayViewerProps) {
    console.log("ReplayViewer MOUNTED", { data });
    const [currentTime, setCurrentTime] = useState(0); // in milliseconds
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Metadata
    const gameDuration = (data.matchDetail.info.gameDuration || 1800) * 1000;
    const participants = data.matchDetail.info.participants;
    
    // Timeline Frames
    const frames = data.timeline.info.frames;
    const interval = data.timeline.info.frameInterval || 60000; // Default 60s

    // Find current frame index
    const currentFrameIndex = Math.floor(currentTime / interval);
    const currentFrame = frames[Math.min(currentFrameIndex, frames.length - 1)];
    const nextFrame = frames[Math.min(currentFrameIndex + 1, frames.length - 1)];

    // Interpolation Factor (0 to 1)
    const t = Math.min((currentTime % interval) / interval, 1);

    // Playback Logic
    useEffect(() => {
        if (isPlaying) {
            const tickRate = 33; // ms
            timerRef.current = setInterval(() => {
                setCurrentTime(prev => {
                    const next = prev + (tickRate * speed); 
                    if (next >= gameDuration) {
                        setIsPlaying(false);
                        return gameDuration;
                    }
                    return next;
                });
            }, tickRate);
        } else if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isPlaying, speed, gameDuration]);

    const formatTime = (ms: number) => {
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col gap-4 h-full w-full max-w-4xl mx-auto">
            {/* Main Stage (Map) */}
            <div className="relative h-[65vh] w-[65vh] mx-auto bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-700 shrink-0">
                {/* Background Map */}
                <div 
                    className="absolute inset-0 bg-cover bg-center opacity-80"
                    style={{ backgroundImage: `url('https://ddragon.leagueoflegends.com/cdn/15.24.1/img/map/map11.png')` }}
                ></div>

                {/* Champions */}
                {participants.map((p: any) => {
                    // Get position from frame
                    if (!currentFrame?.participantFrames) return null;
                    const pFrame = currentFrame.participantFrames[p.participantId.toString()];
                    const pNext = nextFrame?.participantFrames ? nextFrame.participantFrames[p.participantId.toString()] : null;

                    if (!pFrame || !pFrame.position) return null;

                    // Interpolate
                    const x1 = pFrame.position.x;
                    const y1 = pFrame.position.y;
                    const x2 = pNext?.position ? pNext.position.x : x1;
                    const y2 = pNext?.position ? pNext.position.y : y1;

                    const curX = x1 + (x2 - x1) * t;
                    const curY = y1 + (y2 - y1) * t;

                    const left = (curX / MAX_COORD) * 100;
                    const top = (1 - (curY / MAX_COORD)) * 100;

                    const isBlue = p.teamId === 100;

                    return (
                        <div 
                            key={p.participantId}
                            className="absolute w-[4%] h-[4%] -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 ease-linear hover:z-50 group"
                            style={{ left: `${left}%`, top: `${top}%` }}
                        >
                            <div className={`relative w-full h-full rounded-full overflow-hidden border-2 ${isBlue ? 'border-blue-500 shadow-[0_0_10px_blue]' : 'border-red-500 shadow-[0_0_10px_red]'} bg-black`}>
                                <img 
                                    src={`https://ddragon.leagueoflegends.com/cdn/15.24.1/img/champion/${p.championName}.png`} 
                                    alt={p.championName}
                                    className="w-full h-full object-cover scale-110"
                                />
                            </div>
                            {/* Player Name Tooltip */}
                            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/90 border border-slate-700 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50">
                                {p.championName}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Controls */}
            <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex flex-col gap-3 shadow-lg z-10 relative">
                {/* Time Slider */}
                <div className="flex items-center gap-4">
                     <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white rounded-full transition active:scale-95 shadow-lg shadow-blue-900/20"
                    >
                        {isPlaying ? "⏸" : "▶"}
                    </button>
                    
                    <div className="flex-1">
                        <input 
                            type="range" 
                            min={0} 
                            max={gameDuration} 
                            value={currentTime}
                            onChange={(e) => {
                                setCurrentTime(Number(e.target.value));
                            }}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                        />
                        <div className="flex justify-between text-xs text-slate-400 font-mono mt-1">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(gameDuration)}</span>
                        </div>
                    </div>
                </div>

                {/* Speed Controls */}
                <div className="flex justify-end border-t border-slate-800/50 pt-2">
                     <div className="flex items-center gap-1 bg-slate-950/50 rounded-lg p-1 border border-slate-800">
                        <span className="text-[10px] text-slate-500 px-2 uppercase font-bold">Speed</span>
                        {[1, 2, 5, 10, 20].map(s => (
                            <button 
                                key={s}
                                onClick={() => setSpeed(s)}
                                className={`px-2 py-0.5 text-xs font-bold rounded transition ${speed === s ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {s}x
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
