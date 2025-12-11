"use client";

import Link from "next/link";
import { useState } from "react";

type Participant = {
    puuid: string;
    teamId: number;
    summonerName: string;
    championName: string;
    kills: number;
    deaths: number;
    assists: number;
    visionScore: number;
    totalMinionsKilled: number;
    item0: number; // Item ID
    item1: number;
    item2: number;
    item3: number;
    item4: number;
    item5: number;
    item6: number; // Trinket
}

type TeamOverviewCardProps = {
    teamId: number;
    teamName: string;
    participants: Participant[];
    win: boolean;
}

export default function TeamOverviewCard({ teamId, teamName, participants, win }: TeamOverviewCardProps) {

    return (
        <div className={`rounded-xl border ${win ? 'border-blue-500/30 bg-blue-900/10' : 'border-red-500/30 bg-red-900/10'} overflow-hidden`}>
            <div 
                className={`px-4 py-2 text-xs font-bold tracking-wider ${win ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-300'} flex justify-between items-center `}
            >
                <div className="flex items-center gap-2">
                    <span>{teamName}</span>
                    <span className="opacity-50">|</span>
                    <span>{win ? "VICTORY" : "DEFEAT"}</span>
                    <span className="ml-2 px-1.5 py-0.5 bg-black/20 rounded text-[10px] text-white/60">
                        {participants.reduce((acc, p) => acc + p.kills, 0)} / {participants.reduce((acc, p) => acc + p.deaths, 0)} / {participants.reduce((acc, p) => acc + p.assists, 0)}
                    </span>
                </div>
            </div>
            
            <div className="divide-y divide-slate-800">
                {participants.map((p) => (
                    <div key={p.puuid} className="p-3 flex items-center gap-3 hover:bg-white/5 transition group">
                        {/* Champion Icon */}
                        <div className="relative">
                            <img 
                                src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${p.championName}.png`}
                                alt={p.championName}
                                className="w-10 h-10 rounded shadow-md"
                            />
                            <div className="absolute -bottom-1 -right-1 bg-slate-900 text-[9px] text-slate-400 px-1 rounded border border-slate-700">
                                {((p.totalMinionsKilled || 0 )).toString()} CS
                            </div>
                        </div>

                        {/* Name & KDA */}
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white truncate group-hover:text-amber-200 transition-colors">{p.summonerName}</div>
                            <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                                <span className={p.deaths > p.kills ? 'text-slate-400' : 'text-blue-200'}>{p.kills}/{p.deaths}/{p.assists}</span>
                                <span className="text-slate-700">|</span>
                                <span className="flex items-center gap-0.5 text-violet-300">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="opacity-70"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg> 
                                    {p.visionScore}
                                </span>
                            </div>
                        </div>

                        {/* Items (Simplified) */}
                        <div className="flex gap-0.5">
                            {[p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].map((itemId, idx) => (
                                itemId !== 0 ? (
                                    <div key={idx} className="relative group/item">
                                        <img 
                                            src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/${itemId}.png`}
                                            alt={`Item ${itemId}`}
                                            className="w-7 h-7 rounded border border-slate-800 bg-slate-900"
                                        />
                                    </div>
                                ) : (
                                    <div key={idx} className="w-7 h-7 rounded bg-slate-800/20 border border-slate-800/50" />
                                )
                            ))}
                            <div className="w-px bg-slate-700 mx-1 h-7"></div>
                             {p.item6 !== 0 ? (
                                <img 
                                    src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/${p.item6}.png`}
                                    alt="Trinket"
                                    className="w-7 h-7 rounded-full border border-slate-800 bg-slate-900"
                                />
                            ) : ( <div className="w-7 h-7 rounded-full bg-slate-800/20" /> )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
