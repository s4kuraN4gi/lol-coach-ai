"use client";

import Link from "next/link";
import { FaLightbulb, FaChevronDown, FaChevronUp, FaPlay, FaLock, FaCrown } from "react-icons/fa";
import { useTranslation } from "@/contexts/LanguageContext";
import type { GuestAnalysisResult } from "@/app/actions/guestAnalysis";

interface MacroResultSectionProps {
    result: GuestAnalysisResult;
    isGuest: boolean;
    showUpgradeCTA?: boolean;
    expandedSegment: number | null;
    setExpandedSegment: (id: number | null) => void;
    seekToTimestamp: (gameTimeMs: number) => void;
    onReanalyze: () => void;
}

export default function MacroResultSection({
    result,
    isGuest,
    showUpgradeCTA = false,
    expandedSegment,
    setExpandedSegment,
    seekToTimestamp,
    onReanalyze,
}: MacroResultSectionProps) {
    const { t } = useTranslation();

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-5">
            {/* Warnings (if any) */}
            {result.warnings && result.warnings.length > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4">
                    <h4 className="text-yellow-400 font-bold text-sm mb-2">{t('analyzePage.results.warning')}</h4>
                    <ul className="text-xs text-yellow-300/80 space-y-1">
                        {result.warnings.map((w, i) => (
                            <li key={i}>• {w}</li>
                        ))}
                    </ul>
                    <p className="text-xs text-slate-400 mt-2">
                        {t('analyzePage.results.completed').replace('{completed}', String(result.completedSegments)).replace('{requested}', String(result.requestedSegments))}
                    </p>
                </div>
            )}

            {/* Overall Summary */}
            <div className="bg-gradient-to-br from-emerald-900/30 to-cyan-900/30 border border-emerald-500/50 rounded-xl p-5">
                <h3 className="font-bold text-emerald-400 mb-3 flex items-center gap-2">
                    <FaLightbulb />
                    {t('analyzePage.results.summary')}
                </h3>
                <div className="mb-3 p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-white">{result.overallSummary.mainIssue}</p>
                </div>
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <div className="text-xs text-blue-400 font-bold mb-1">
                        {t('analyzePage.results.homework')}
                    </div>
                    <h4 className="text-white font-bold mb-1">
                        {result.overallSummary.homework.title}
                    </h4>
                    {isGuest ? (
                        <div className="relative">
                            <p className="text-sm text-slate-300 mb-2 blur-sm select-none" aria-hidden="true">
                                {result.overallSummary.homework.description}
                            </p>
                            <p className="text-xs text-cyan-400 blur-sm select-none" aria-hidden="true">
                                ✅ {result.overallSummary.homework.howToCheck}
                            </p>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <FaLock className="text-amber-400 text-lg mb-2" />
                                <p className="text-xs text-slate-300 mb-2">{t('analyzePage.blur.message', 'Sign up free to see details')}</p>
                                <Link href="/signup" className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 text-xs font-bold hover:from-amber-400 hover:to-orange-400 transition-all">
                                    {t('analyzePage.blur.cta', 'Sign up free')}
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-slate-300 mb-2">
                                {result.overallSummary.homework.description}
                            </p>
                            <p className="text-xs text-cyan-400">
                                ✅ {result.overallSummary.homework.howToCheck}
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* Inline CTA for guests — after summary, before segments */}
            {isGuest && (
                <div className="flex items-center gap-4 bg-gradient-to-r from-blue-900/30 to-cyan-900/20 border border-blue-500/30 rounded-xl p-4">
                    <div className="flex-shrink-0">
                        <FaCrown className="text-amber-400 text-xl" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">
                            {t('analyzePage.inlineCta.title', 'Sign up for deeper analysis')}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {t('analyzePage.inlineCta.desc', 'Riot API integration, analysis history, AI coaching')}
                        </p>
                    </div>
                    <Link
                        href="/signup"
                        className="flex-shrink-0 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 text-xs font-bold hover:from-amber-400 hover:to-orange-400 transition-all whitespace-nowrap"
                    >
                        {t('analyzePage.inlineCta.cta', 'Sign up free')}
                    </Link>
                </div>
            )}

            {/* Inline CTA for free users — upgrade to Premium */}
            {!isGuest && showUpgradeCTA && (
                <div className="flex items-center gap-4 bg-gradient-to-r from-amber-900/20 to-orange-900/10 border border-amber-500/30 rounded-xl p-4">
                    <div className="flex-shrink-0">
                        <FaCrown className="text-amber-400 text-xl" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">
                            {t('analyzePage.upgradeCta.title', 'Upgrade to Premium')}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {t('analyzePage.upgradeCta.desc', '20 analyses/week, AI coaching, video analysis & more')}
                        </p>
                    </div>
                    <Link
                        href="/pricing"
                        className="flex-shrink-0 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 text-xs font-bold hover:from-amber-400 hover:to-orange-400 transition-all whitespace-nowrap"
                    >
                        {t('analyzePage.upgradeCta.cta', 'View Plans')}
                    </Link>
                </div>
            )}

            {/* Segment Results */}
            <div className="space-y-2">
                <h4 className="font-bold text-slate-300 text-sm">
                    {t('analyzePage.results.sceneAnalysis')}
                </h4>
                {isGuest ? (
                    <>
                        {/* First segment fully visible for guests (endowment effect) */}
                        {result.segments.slice(0, 1).map((seg) => (
                            <div
                                key={seg.segmentId}
                                className="bg-slate-800/50 rounded-lg border border-emerald-500/30 overflow-hidden"
                            >
                                <button
                                    onClick={() => setExpandedSegment(
                                        expandedSegment === seg.segmentId ? null : seg.segmentId
                                    )}
                                    className="w-full p-3 flex items-center justify-between hover:bg-slate-700/50 transition"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-emerald-400 font-mono">{seg.timestamp}</span>
                                        <span className="text-sm text-white">{seg.winningPattern.title}</span>
                                    </div>
                                    {expandedSegment === seg.segmentId
                                        ? <FaChevronUp className="text-slate-400" />
                                        : <FaChevronDown className="text-slate-400" />}
                                </button>
                                {expandedSegment === seg.segmentId && (
                                    <div className="p-4 border-t border-slate-700 space-y-3 animate-in slide-in-from-top-2">
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="p-2 bg-slate-900/50 rounded">
                                                <span className="text-slate-400">{t('analyzePage.results.position')}</span>
                                                <p className="text-slate-300">{seg.observation.userPosition}</p>
                                            </div>
                                            <div className="p-2 bg-slate-900/50 rounded">
                                                <span className="text-slate-400">{t('analyzePage.results.wave')}</span>
                                                <p className="text-slate-300">{seg.observation.waveState}</p>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                                            <div className="text-xs font-bold text-emerald-400 mb-2">
                                                {t('analyzePage.results.winPattern')} {seg.winningPattern.macroConceptUsed}
                                            </div>
                                            <ol className="space-y-1">
                                                {seg.winningPattern.steps.map((step, i) => (
                                                    <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                                        <span className="text-emerald-400 font-bold">{i + 1}.</span>
                                                        {step}
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                        <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                                            <div className="text-xs font-bold text-orange-400 mb-1">
                                                {t('analyzePage.results.improvement')}
                                            </div>
                                            <p className="text-sm text-slate-300 mb-2">{seg.improvement.description}</p>
                                            <p className="text-xs text-yellow-400">
                                                💡 {seg.improvement.actionableAdvice}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const [min, sec] = seg.timestamp.split(':').map(Number);
                                                seekToTimestamp((min * 60 + sec - 30) * 1000);
                                            }}
                                            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                                        >
                                            <FaPlay /> {t('analyzePage.results.checkVideo')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {/* Remaining segments blurred with CTA */}
                        {result.segments.length > 1 && (
                            <div className="relative">
                                <div className="space-y-2 blur-sm select-none pointer-events-none" aria-hidden="true">
                                    {result.segments.slice(1).map((seg) => (
                                        <div key={seg.segmentId} className="bg-slate-800/50 rounded-lg border border-slate-700 p-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-emerald-400 font-mono">{seg.timestamp}</span>
                                                <span className="text-sm text-white">{seg.winningPattern.title}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 rounded-xl">
                                    <FaLock className="text-amber-400 text-2xl mb-3" />
                                    <p className="text-sm text-white font-bold mb-1">{t('analyzePage.blur.segmentTitle', 'See remaining scene analysis')}</p>
                                    <p className="text-xs text-slate-400 mb-3">{t('analyzePage.blur.segmentDesc', 'View winning patterns and improvements for each scene')}</p>
                                    <Link href="/signup" className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 text-sm font-bold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20">
                                        {t('analyzePage.blur.cta', 'Sign up free')}
                                    </Link>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    result.segments.map((seg) => (
                        <div
                            key={seg.segmentId}
                            className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden"
                        >
                            <button
                                onClick={() => setExpandedSegment(
                                    expandedSegment === seg.segmentId ? null : seg.segmentId
                                )}
                                className="w-full p-3 flex items-center justify-between hover:bg-slate-700/50 transition"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-emerald-400 font-mono">
                                        {seg.timestamp}
                                    </span>
                                    <span className="text-sm text-white">
                                        {seg.winningPattern.title}
                                    </span>
                                </div>
                                {expandedSegment === seg.segmentId
                                    ? <FaChevronUp className="text-slate-400" />
                                    : <FaChevronDown className="text-slate-400" />}
                            </button>

                            {expandedSegment === seg.segmentId && (
                                <div className="p-4 border-t border-slate-700 space-y-3 animate-in slide-in-from-top-2">
                                    {/* Observation */}
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="p-2 bg-slate-900/50 rounded">
                                            <span className="text-slate-400">{t('analyzePage.results.position')}</span>
                                            <p className="text-slate-300">{seg.observation.userPosition}</p>
                                        </div>
                                        <div className="p-2 bg-slate-900/50 rounded">
                                            <span className="text-slate-400">{t('analyzePage.results.wave')}</span>
                                            <p className="text-slate-300">{seg.observation.waveState}</p>
                                        </div>
                                    </div>

                                    {/* Winning Pattern */}
                                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                                        <div className="text-xs font-bold text-emerald-400 mb-2">
                                            {t('analyzePage.results.winPattern')} {seg.winningPattern.macroConceptUsed}
                                        </div>
                                        <ol className="space-y-1">
                                            {seg.winningPattern.steps.map((step, i) => (
                                                <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                                    <span className="text-emerald-400 font-bold">{i + 1}.</span>
                                                    {step}
                                                </li>
                                            ))}
                                        </ol>
                                    </div>

                                    {/* Improvement */}
                                    <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                                        <div className="text-xs font-bold text-orange-400 mb-1">
                                            {t('analyzePage.results.improvement')}
                                        </div>
                                        <p className="text-sm text-slate-300 mb-2">
                                            {seg.improvement.description}
                                        </p>
                                        <p className="text-xs text-yellow-400">
                                            💡 {seg.improvement.actionableAdvice}
                                        </p>
                                    </div>

                                    {/* Seek Button */}
                                    <button
                                        onClick={() => {
                                            const [min, sec] = seg.timestamp.split(':').map(Number);
                                            seekToTimestamp((min * 60 + sec - 30) * 1000);
                                        }}
                                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                                    >
                                        <FaPlay /> {t('analyzePage.results.checkVideo')}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Re-analyze Button */}
            <button
                onClick={onReanalyze}
                className="w-full py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:border-slate-600 transition"
            >
                {t('analyzePage.results.reanalyze')}
            </button>

            {/* Remaining Credits */}
            <div className="text-center text-sm text-slate-400">
                {t('analyzePage.results.remainingCredits').replace('{remaining}', String(result.remainingCredits))}
            </div>

            {/* Upsell CTA for guests */}
            {isGuest && (
                <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/10 border border-amber-500/30 rounded-xl p-5 text-center">
                    <div className="text-2xl mb-2">
                        <FaCrown className="inline text-amber-400" />
                    </div>
                    <h4 className="text-white font-bold mb-1">
                        {t('analyzePage.upsell.title', 'Get more from your analysis')}
                    </h4>
                    <p className="text-xs text-slate-400 mb-3">
                        {t('analyzePage.upsell.desc', 'Save analysis history, AI coaching, match data integration')}
                    </p>
                    <Link
                        href="/signup"
                        className="inline-block px-6 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 text-sm font-bold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
                    >
                        {t('analyzePage.upsell.cta', 'Sign up free')}
                    </Link>
                    <p className="text-[10px] text-slate-400 mt-2">
                        {t('analyzePage.upsell.trial', 'Premium includes 7-day free trial')}
                    </p>
                </div>
            )}

            {/* Upsell CTA for free users */}
            {!isGuest && showUpgradeCTA && (
                <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/10 border border-amber-500/30 rounded-xl p-5 text-center">
                    <div className="text-2xl mb-2">
                        <FaCrown className="inline text-amber-400" />
                    </div>
                    <h4 className="text-white font-bold mb-1">
                        {t('analyzePage.upgradeCta.title', 'Upgrade to Premium')}
                    </h4>
                    <p className="text-xs text-slate-400 mb-3">
                        {t('analyzePage.upgradeCta.desc', '20 analyses/week, AI coaching, video analysis & more')}
                    </p>
                    <Link
                        href="/pricing"
                        className="inline-block px-6 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 text-sm font-bold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
                    >
                        {t('analyzePage.upgradeCta.cta', 'View Plans')}
                    </Link>
                    <p className="text-[10px] text-slate-400 mt-2">
                        {t('analyzePage.upsell.trial', 'Premium includes 7-day free trial')}
                    </p>
                </div>
            )}
        </div>
    );
}
