"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { createPortal } from "react-dom";

type Props = {
    tier: string;
    rank: string;
    onClose: () => void;
};

// Tier colors
const TIER_COLORS: Record<string, { primary: string; secondary: string; glow: string }> = {
    'IRON': { primary: '#5c4033', secondary: '#8b7355', glow: 'rgba(92, 64, 51, 0.6)' },
    'BRONZE': { primary: '#cd7f32', secondary: '#e8a862', glow: 'rgba(205, 127, 50, 0.6)' },
    'SILVER': { primary: '#c0c0c0', secondary: '#e8e8e8', glow: 'rgba(192, 192, 192, 0.6)' },
    'GOLD': { primary: '#ffd700', secondary: '#ffec8b', glow: 'rgba(255, 215, 0, 0.6)' },
    'PLATINUM': { primary: '#00cec9', secondary: '#81ecec', glow: 'rgba(0, 206, 201, 0.6)' },
    'EMERALD': { primary: '#2ecc71', secondary: '#58d68d', glow: 'rgba(46, 204, 113, 0.6)' },
    'DIAMOND': { primary: '#b9f2ff', secondary: '#e0f7fa', glow: 'rgba(185, 242, 255, 0.6)' },
    'MASTER': { primary: '#9b59b6', secondary: '#bb8fce', glow: 'rgba(155, 89, 182, 0.6)' },
    'GRANDMASTER': { primary: '#e74c3c', secondary: '#f1948a', glow: 'rgba(231, 76, 60, 0.6)' },
    'CHALLENGER': { primary: '#f1c40f', secondary: '#f9e79f', glow: 'rgba(241, 196, 15, 0.6)' },
};

const getTierEmblemUrl = (tier: string) => {
    return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tier.toLowerCase()}.png`;
};

export default function RankAchievementModal({ tier, rank, onClose }: Props) {
    const { t } = useTranslation();
    const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');
    const [mounted, setMounted] = useState(false);

    const colors = TIER_COLORS[tier.toUpperCase()] || TIER_COLORS['GOLD'];
    const isMasterPlus = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier.toUpperCase());

    useEffect(() => {
        setMounted(true);

        // Animation phases
        const enterTimer = setTimeout(() => setPhase('show'), 100);
        const autoCloseTimer = setTimeout(() => {
            setPhase('exit');
            setTimeout(onClose, 500);
        }, 4000);

        return () => {
            clearTimeout(enterTimer);
            clearTimeout(autoCloseTimer);
        };
    }, [onClose]);

    const handleClose = () => {
        setPhase('exit');
        setTimeout(onClose, 500);
    };

    if (!mounted) return null;

    const modalContent = (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-500 ${
                phase === 'enter' ? 'opacity-0' :
                phase === 'exit' ? 'opacity-0' : 'opacity-100'
            }`}
            onClick={handleClose}
        >
            {/* Backdrop with radial glow */}
            <div
                className="absolute inset-0 bg-black/80"
                style={{
                    background: `radial-gradient(circle at center, ${colors.glow} 0%, rgba(0,0,0,0.95) 70%)`
                }}
            />

            {/* Particle effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {Array.from({ length: 20 }).map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-2 h-2 rounded-full animate-float-up"
                        style={{
                            left: `${Math.random() * 100}%`,
                            bottom: '-10px',
                            backgroundColor: i % 2 === 0 ? colors.primary : colors.secondary,
                            animationDelay: `${Math.random() * 2}s`,
                            animationDuration: `${2 + Math.random() * 2}s`,
                            opacity: 0.6,
                        }}
                    />
                ))}
            </div>

            {/* Main Content */}
            <div
                className={`relative z-10 text-center transition-all duration-700 ${
                    phase === 'enter' ? 'scale-50 opacity-0' :
                    phase === 'exit' ? 'scale-150 opacity-0' : 'scale-100 opacity-100'
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Emblem with glow */}
                <div className="relative mb-6">
                    {/* Outer glow ring */}
                    <div
                        className="absolute inset-0 rounded-full blur-3xl animate-pulse-slow"
                        style={{
                            background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
                            transform: 'scale(1.5)',
                        }}
                    />

                    {/* Inner glow ring */}
                    <div
                        className="absolute inset-0 rounded-full blur-xl animate-pulse"
                        style={{
                            background: `radial-gradient(circle, ${colors.primary}40 0%, transparent 60%)`,
                            transform: 'scale(1.2)',
                        }}
                    />

                    {/* Emblem */}
                    <img
                        src={getTierEmblemUrl(tier)}
                        alt={tier}
                        className={`relative w-48 h-48 mx-auto drop-shadow-2xl transition-transform duration-700 ${
                            phase === 'show' ? 'animate-emblem-entrance' : ''
                        }`}
                        style={{
                            filter: `drop-shadow(0 0 30px ${colors.glow})`,
                        }}
                    />
                </div>

                {/* Text */}
                <div
                    className={`transition-all duration-500 delay-300 ${
                        phase === 'show' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                    }`}
                >
                    <h2
                        className="text-4xl font-black tracking-wider mb-2"
                        style={{ color: colors.primary, textShadow: `0 0 20px ${colors.glow}` }}
                    >
                        {tier} {!isMasterPlus && rank}
                    </h2>

                    <p className="text-xl text-white font-bold mb-4">
                        {t('widgets.rankGoal.achievementTitle')}
                    </p>

                    <p className="text-slate-400 text-sm mb-6">
                        {t('widgets.rankGoal.achievementMessage')}
                    </p>

                    {/* Buttons */}
                    <div className="flex justify-center gap-3">
                        <button
                            onClick={handleClose}
                            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            {t('widgets.rankGoal.close')}
                        </button>
                    </div>
                </div>
            </div>

            {/* CSS for animations */}
            <style jsx>{`
                @keyframes float-up {
                    0% {
                        transform: translateY(0) rotate(0deg);
                        opacity: 0.6;
                    }
                    100% {
                        transform: translateY(-100vh) rotate(360deg);
                        opacity: 0;
                    }
                }

                @keyframes emblem-entrance {
                    0% {
                        transform: scale(0.3) rotate(-10deg);
                        opacity: 0;
                    }
                    50% {
                        transform: scale(1.2) rotate(5deg);
                    }
                    100% {
                        transform: scale(1) rotate(0deg);
                        opacity: 1;
                    }
                }

                @keyframes pulse-slow {
                    0%, 100% {
                        opacity: 0.6;
                        transform: scale(1.5);
                    }
                    50% {
                        opacity: 0.8;
                        transform: scale(1.7);
                    }
                }

                .animate-float-up {
                    animation: float-up linear infinite;
                }

                .animate-emblem-entrance {
                    animation: emblem-entrance 0.8s ease-out forwards;
                }

                .animate-pulse-slow {
                    animation: pulse-slow 2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );

    return createPortal(modalContent, document.body);
}
