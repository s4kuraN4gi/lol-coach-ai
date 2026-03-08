"use client";

import { useState } from "react";
import Link from "next/link";
import { FaChevronDown, FaChevronUp, FaLock, FaCrown } from "react-icons/fa";
import { useTranslation } from "@/contexts/LanguageContext";
import type { VisionAnalysisResult } from "@/app/actions/vision";

const gradeColors: Record<string, string> = {
    'S': 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50',
    'A': 'text-green-400 bg-green-500/20 border-green-500/50',
    'B': 'text-blue-400 bg-blue-500/20 border-blue-500/50',
    'C': 'text-orange-400 bg-orange-500/20 border-orange-500/50',
    'D': 'text-red-400 bg-red-500/20 border-red-500/50',
};

const priorityColors: Record<string, string> = {
    'HIGH': 'bg-red-500/20 text-red-400 border-red-500/50',
    'MEDIUM': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    'LOW': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
};

const outcomeColors: Record<string, string> = {
    'WIN': 'text-green-400',
    'LOSE': 'text-red-400',
    'EVEN': 'text-yellow-400',
    'NO_TRADE': 'text-slate-400',
};

interface MicroResultSectionProps {
    microResult: VisionAnalysisResult;
    isGuest: boolean;
    showUpgradeCTA?: boolean;
    onReanalyze: () => void;
}

export default function MicroResultSection({
    microResult,
    isGuest,
    showUpgradeCTA = false,
    onReanalyze,
}: MicroResultSectionProps) {
    const { t } = useTranslation();

    const [expandedMicroSections, setExpandedMicroSections] = useState<Record<string, boolean>>({
        situation: true,
        trade: true,
        mechanics: true,
        improvements: true,
    });

    const toggleMicroSection = (section: string) => {
        setExpandedMicroSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-5">
            {/* Header with Grade */}
            {microResult.enhanced ? (
                <>
                    <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-purple-500/50">
                        <div>
                            <h4 className="font-bold text-white text-lg">{t('analyzePage.micro.clipSelector')}</h4>
                            <p className="text-sm text-slate-400">
                                {microResult.enhanced.championContext.championName} ({microResult.enhanced.championContext.role})
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl font-bold ${gradeColors[microResult.enhanced.overallGrade]}`}>
                                {microResult.enhanced.overallGrade}
                            </div>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                        <p className="text-sm text-slate-300 leading-relaxed">{microResult.summary}</p>
                    </div>

                    {isGuest ? (
                        <>
                        {/* First section (Situation Snapshot) fully visible for guests */}
                        <div className="bg-slate-900 rounded-xl border border-purple-500/30 overflow-hidden">
                            <div className="p-4">
                                <h5 className="font-bold text-white flex items-center gap-2 mb-3">
                                    <span className="text-purple-400">📊</span>
                                    {t('analyzePage.micro.situationSnapshot')}
                                    <span className="text-xs text-slate-400">@ {microResult.enhanced.situationSnapshot.gameTime}</span>
                                </h5>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-blue-900/20 p-3 rounded-lg border border-blue-500/30">
                                        <h6 className="text-xs font-bold text-blue-400 mb-2">{t('coachPage.micro.myStatus', 'Me')}</h6>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">HP</span>
                                                <span className={`font-medium ${microResult.enhanced!.situationSnapshot.myStatus.hpPercent > 50 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {microResult.enhanced!.situationSnapshot.myStatus.hpPercent}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Mana</span>
                                                <span className={`font-medium ${microResult.enhanced!.situationSnapshot.myStatus.manaPercent > 30 ? 'text-blue-400' : 'text-orange-400'}`}>
                                                    {microResult.enhanced!.situationSnapshot.myStatus.manaPercent}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Lv</span>
                                                <span className="text-white font-medium">{microResult.enhanced!.situationSnapshot.myStatus.level}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-red-900/20 p-3 rounded-lg border border-red-500/30">
                                        <h6 className="text-xs font-bold text-red-400 mb-2">{t('coachPage.micro.enemyStatus', 'Enemy')}</h6>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">HP</span>
                                                <span className={`font-medium ${microResult.enhanced!.situationSnapshot.enemyStatus.hpPercent > 50 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {microResult.enhanced!.situationSnapshot.enemyStatus.hpPercent}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Mana</span>
                                                <span className={`font-medium ${microResult.enhanced!.situationSnapshot.enemyStatus.manaPercent > 30 ? 'text-blue-400' : 'text-orange-400'}`}>
                                                    {microResult.enhanced!.situationSnapshot.enemyStatus.manaPercent}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Lv</span>
                                                <span className="text-white font-medium">{microResult.enhanced!.situationSnapshot.enemyStatus.level}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2 bg-slate-800/50 rounded">
                                        <span className="text-slate-400">Wave</span>
                                        <p className="text-slate-300">{microResult.enhanced!.situationSnapshot.environment.wavePosition}</p>
                                    </div>
                                    <div className="p-2 bg-slate-800/50 rounded">
                                        <span className="text-slate-400">Jungler</span>
                                        <p className="text-slate-300">{microResult.enhanced!.situationSnapshot.environment.junglerThreat}</p>
                                    </div>
                                    <div className="p-2 bg-slate-800/50 rounded">
                                        <span className="text-slate-400">Minions</span>
                                        <p className="text-slate-300">{microResult.enhanced!.situationSnapshot.environment.minionAdvantage}</p>
                                    </div>
                                    <div className="p-2 bg-slate-800/50 rounded">
                                        <span className="text-slate-400">Vision</span>
                                        <p className="text-slate-300">{microResult.enhanced!.situationSnapshot.environment.visionControl}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Remaining sections blurred with CTA */}
                        <div className="relative">
                            <div className="space-y-3 blur-sm select-none pointer-events-none" aria-hidden="true">
                                <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
                                    <h5 className="font-bold text-white">⚔️ {t('analyzePage.micro.tradeAnalysis')}</h5>
                                </div>
                                <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
                                    <h5 className="font-bold text-white">🎮 {t('analyzePage.micro.mechanics')}</h5>
                                </div>
                                <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
                                    <h5 className="font-bold text-white">💡 {t('analyzePage.micro.improvements')}</h5>
                                </div>
                            </div>
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 rounded-xl">
                                <FaLock className="text-amber-400 text-2xl mb-3" />
                                <p className="text-sm text-white font-bold mb-1">{t('analyzePage.blur.microTitle', 'See detailed analysis')}</p>
                                <p className="text-xs text-slate-400 mb-3">{t('analyzePage.blur.microDesc', 'View trade analysis, mechanics evaluation, and improvements')}</p>
                                <Link href="/signup" className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 text-sm font-bold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20">
                                    {t('analyzePage.blur.cta', 'Sign up free')}
                                </Link>
                            </div>
                        </div>
                        </>
                    ) : (
                    <>
                    {/* Situation Snapshot */}
                    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                        <button
                            onClick={() => toggleMicroSection('situation')}
                            className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition"
                        >
                            <h5 className="font-bold text-white flex items-center gap-2">
                                <span className="text-purple-400">📊</span>
                                {t('analyzePage.micro.situationSnapshot')}
                                <span className="text-xs text-slate-400">@ {microResult.enhanced.situationSnapshot.gameTime}</span>
                            </h5>
                            {expandedMicroSections.situation ? <FaChevronUp className="text-slate-400" /> : <FaChevronDown className="text-slate-400" />}
                        </button>
                        {expandedMicroSections.situation && (
                            <div className="p-4 border-t border-slate-800">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-blue-900/20 p-3 rounded-lg border border-blue-500/30">
                                        <h6 className="text-xs font-bold text-blue-400 mb-2">{t('coachPage.micro.myStatus', 'Me')}</h6>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">HP</span>
                                                <span className={`font-medium ${microResult.enhanced!.situationSnapshot.myStatus.hpPercent > 50 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {microResult.enhanced!.situationSnapshot.myStatus.hpPercent}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Mana</span>
                                                <span className={`font-medium ${microResult.enhanced!.situationSnapshot.myStatus.manaPercent > 30 ? 'text-blue-400' : 'text-orange-400'}`}>
                                                    {microResult.enhanced!.situationSnapshot.myStatus.manaPercent}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Lv</span>
                                                <span className="text-white font-medium">{microResult.enhanced!.situationSnapshot.myStatus.level}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-red-900/20 p-3 rounded-lg border border-red-500/30">
                                        <h6 className="text-xs font-bold text-red-400 mb-2">{t('coachPage.micro.enemyStatus', 'Enemy')}</h6>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">HP</span>
                                                <span className={`font-medium ${microResult.enhanced!.situationSnapshot.enemyStatus.hpPercent > 50 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {microResult.enhanced!.situationSnapshot.enemyStatus.hpPercent}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Mana</span>
                                                <span className={`font-medium ${microResult.enhanced!.situationSnapshot.enemyStatus.manaPercent > 30 ? 'text-blue-400' : 'text-orange-400'}`}>
                                                    {microResult.enhanced!.situationSnapshot.enemyStatus.manaPercent}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Lv</span>
                                                <span className="text-white font-medium">{microResult.enhanced!.situationSnapshot.enemyStatus.level}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2 bg-slate-800/50 rounded">
                                        <span className="text-slate-400">Wave</span>
                                        <p className="text-slate-300">{microResult.enhanced!.situationSnapshot.environment.wavePosition}</p>
                                    </div>
                                    <div className="p-2 bg-slate-800/50 rounded">
                                        <span className="text-slate-400">Jungler</span>
                                        <p className="text-slate-300">{microResult.enhanced!.situationSnapshot.environment.junglerThreat}</p>
                                    </div>
                                    <div className="p-2 bg-slate-800/50 rounded">
                                        <span className="text-slate-400">Minions</span>
                                        <p className="text-slate-300">{microResult.enhanced!.situationSnapshot.environment.minionAdvantage}</p>
                                    </div>
                                    <div className="p-2 bg-slate-800/50 rounded">
                                        <span className="text-slate-400">Vision</span>
                                        <p className="text-slate-300">{microResult.enhanced!.situationSnapshot.environment.visionControl}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Trade Analysis */}
                    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                        <button
                            onClick={() => toggleMicroSection('trade')}
                            className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition"
                        >
                            <h5 className="font-bold text-white flex items-center gap-2">
                                <span className="text-orange-400">⚔️</span>
                                {t('analyzePage.micro.tradeAnalysis')}
                                <span className={`text-xs font-bold ${outcomeColors[microResult.enhanced!.tradeAnalysis.outcome]}`}>
                                    {microResult.enhanced!.tradeAnalysis.outcome}
                                </span>
                            </h5>
                            {expandedMicroSections.trade ? <FaChevronUp className="text-slate-400" /> : <FaChevronDown className="text-slate-400" />}
                        </button>
                        {expandedMicroSections.trade && (
                            <div className="p-4 border-t border-slate-800 space-y-3">
                                <p className="text-sm text-slate-300">{microResult.enhanced!.tradeAnalysis.reason}</p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2 bg-slate-800/50 rounded">
                                        <span className="text-slate-400">{t('analyzePage.micro.damageGiven')}</span>
                                        <p className="text-slate-300">{microResult.enhanced!.tradeAnalysis.hpExchanged.damageGiven}</p>
                                    </div>
                                    <div className="p-2 bg-slate-800/50 rounded">
                                        <span className="text-slate-400">{t('analyzePage.micro.damageTaken')}</span>
                                        <p className="text-slate-300">{microResult.enhanced!.tradeAnalysis.hpExchanged.damageTaken}</p>
                                    </div>
                                </div>
                                {microResult.enhanced!.tradeAnalysis.cooldownContext && (
                                    <div className="p-2 bg-slate-800/50 rounded text-xs">
                                        <span className="text-slate-400">{t('analyzePage.micro.cdContext')}</span>
                                        <p className="text-slate-300">{microResult.enhanced!.tradeAnalysis.cooldownContext}</p>
                                    </div>
                                )}
                                {microResult.enhanced!.tradeAnalysis.optimalAction && (
                                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                                        <h6 className="text-xs font-bold text-emerald-400 mb-1">{t('analyzePage.micro.optimalAction')}</h6>
                                        <p className="text-sm text-slate-300">{microResult.enhanced!.tradeAnalysis.optimalAction}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Mechanics Evaluation */}
                    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                        <button
                            onClick={() => toggleMicroSection('mechanics')}
                            className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition"
                        >
                            <h5 className="font-bold text-white flex items-center gap-2">
                                <span className="text-cyan-400">🎮</span>
                                {t('analyzePage.micro.mechanics')}
                            </h5>
                            {expandedMicroSections.mechanics ? <FaChevronUp className="text-slate-400" /> : <FaChevronDown className="text-slate-400" />}
                        </button>
                        {expandedMicroSections.mechanics && (
                            <div className="p-4 border-t border-slate-800 space-y-3">
                                {/* Positioning */}
                                <div className="p-2 bg-slate-800/50 rounded text-sm">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-slate-400">{t('analyzePage.micro.positioning')}</span>
                                        <span className="text-xs font-bold text-purple-400">{microResult.enhanced!.mechanicsEvaluation.positioningScore}</span>
                                    </div>
                                    <p className="text-slate-300">{microResult.enhanced!.mechanicsEvaluation.positioningNote}</p>
                                </div>
                                {/* Combo */}
                                <div className="p-2 bg-slate-800/50 rounded text-sm">
                                    <span className="text-xs text-slate-400">{t('analyzePage.micro.comboExecution')}</span>
                                    <p className="text-slate-300">{microResult.enhanced!.mechanicsEvaluation.comboExecution}</p>
                                </div>
                                {/* Auto Attack Weaving */}
                                <div className="p-2 bg-slate-800/50 rounded text-sm">
                                    <span className="text-xs text-slate-400">{t('analyzePage.micro.autoAttackWeaving')}</span>
                                    <p className="text-slate-300">{microResult.enhanced!.mechanicsEvaluation.autoAttackWeaving}</p>
                                </div>
                                {/* Skills Used */}
                                {microResult.enhanced!.mechanicsEvaluation.skillsUsed.length > 0 && (
                                    <div className="space-y-1">
                                        <span className="text-xs text-slate-400">{t('analyzePage.micro.skills')}</span>
                                        {microResult.enhanced!.mechanicsEvaluation.skillsUsed.map((skill, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-xs p-1.5 bg-slate-900/50 rounded">
                                                <span className="font-mono font-bold text-white">{skill.skill}</span>
                                                <span className={skill.hit === true ? 'text-green-400' : skill.hit === false ? 'text-red-400' : 'text-slate-400'}>
                                                    {skill.hit === true ? t('analyzePage.micro.hit') : skill.hit === false ? t('analyzePage.micro.missed') : t('analyzePage.micro.na')}
                                                </span>
                                                <span className="text-slate-400">{skill.timing}</span>
                                                <span className="text-slate-400 flex-1 truncate">{skill.note}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Improvements */}
                    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                        <button
                            onClick={() => toggleMicroSection('improvements')}
                            className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition"
                        >
                            <h5 className="font-bold text-white flex items-center gap-2">
                                <span className="text-yellow-400">💡</span>
                                {t('analyzePage.micro.improvements')}
                                <span className="text-xs text-slate-400">({microResult.enhanced!.improvements.length})</span>
                            </h5>
                            {expandedMicroSections.improvements ? <FaChevronUp className="text-slate-400" /> : <FaChevronDown className="text-slate-400" />}
                        </button>
                        {expandedMicroSections.improvements && (
                            <div className="p-4 border-t border-slate-800 space-y-3">
                                {microResult.enhanced!.improvements.map((imp, idx) => (
                                    <div key={idx} className="p-3 bg-slate-800/50 rounded-lg border-l-2 border-yellow-500/50">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColors[imp.priority]}`}>
                                                {imp.priority}
                                            </span>
                                            <span className="text-xs text-slate-400">{imp.category}</span>
                                        </div>
                                        <p className="text-sm text-white font-medium mb-1">{imp.title}</p>
                                        <p className="text-sm text-red-400/80">{imp.currentBehavior}</p>
                                        <p className="text-sm text-emerald-400/80">{imp.idealBehavior}</p>
                                        {imp.practice && (
                                            <p className="text-xs text-cyan-400 mt-2">🎯 {imp.practice}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    </>
                    )}
                </>
            ) : (
                /* Legacy fallback (no enhanced data) */
                <div className="bg-slate-900 p-4 rounded-xl border border-purple-500/50">
                    <h4 className="font-bold text-white mb-3">{t('analyzePage.micro.clipSelector')}</h4>
                    <div className="space-y-3">
                        <div>
                            <h5 className="text-xs font-bold text-purple-400 mb-1">{t('analyzePage.results.summary')}</h5>
                            <p className="text-sm text-slate-300">{microResult.summary}</p>
                        </div>
                        {microResult.mistakes.length > 0 && (
                            <div>
                                <h5 className="text-xs font-bold text-red-400 mb-1">{t('analyzePage.results.improvement')}</h5>
                                <ul className="space-y-2">
                                    {microResult.mistakes.map((mk, idx) => (
                                        <li key={idx} className="text-sm text-slate-300 bg-slate-800/50 p-2 rounded border-l-2 border-red-500">
                                            <span className="font-bold text-red-300">[{mk.timestamp}] {mk.title}</span><br />
                                            {mk.advice}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {microResult.finalAdvice && (
                            <div className="p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                                <p className="text-sm text-slate-300">{microResult.finalAdvice}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Upsell CTA for guests (micro) */}
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

            {/* Upsell CTA for free users (micro) */}
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

            {/* Re-analyze Button */}
            <button
                onClick={onReanalyze}
                className="w-full py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:border-slate-600 transition"
            >
                {t('analyzePage.results.reanalyze')}
            </button>
        </div>
    );
}
