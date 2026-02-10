'use client';

import { useState } from 'react';
import { type VisionAnalysisResult } from '@/app/actions/vision';
import { useTranslation } from '@/contexts/LanguageContext';
import { FaChevronDown, FaChevronUp, FaExclamationTriangle, FaCheckCircle, FaTimesCircle, FaQuestionCircle } from 'react-icons/fa';

type Props = {
    result: VisionAnalysisResult;
    onReanalyze?: () => void;
};

// Grade color mapping
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

export default function MicroAnalysisResult({ result, onReanalyze }: Props) {
    const { t } = useTranslation();
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        situation: true,
        trade: true,
        mechanics: true,
        improvements: true,
    });

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Translation helpers for enum values
    const translateTiming = (timing: string) => {
        const timingMap: Record<string, string> = {
            'PERFECT': t('coachPage.micro.enums.timing.perfect', 'Perfect'),
            'GOOD': t('coachPage.micro.enums.timing.good', 'Good'),
            'EARLY': t('coachPage.micro.enums.timing.early', 'Early'),
            'LATE': t('coachPage.micro.enums.timing.late', 'Late'),
            'MISSED_OPPORTUNITY': t('coachPage.micro.enums.timing.missed', 'Missed'),
        };
        return timingMap[timing] || timing;
    };

    const translateDifficulty = (difficulty: string) => {
        const difficultyMap: Record<string, string> = {
            'EASY': t('coachPage.micro.enums.difficulty.easy', 'Easy'),
            'MEDIUM': t('coachPage.micro.enums.difficulty.medium', 'Medium'),
            'HARD': t('coachPage.micro.enums.difficulty.hard', 'Hard'),
        };
        return difficultyMap[difficulty] || difficulty;
    };

    const translateOutcome = (outcome: string) => {
        const outcomeMap: Record<string, string> = {
            'WIN': t('coachPage.micro.enums.outcome.win', 'Win'),
            'LOSE': t('coachPage.micro.enums.outcome.lose', 'Lose'),
            'EVEN': t('coachPage.micro.enums.outcome.even', 'Even'),
            'NO_TRADE': t('coachPage.micro.enums.outcome.noTrade', 'No Trade'),
        };
        return outcomeMap[outcome] || outcome;
    };

    const translatePriority = (priority: string) => {
        const priorityMap: Record<string, string> = {
            'HIGH': t('coachPage.micro.enums.priority.high', 'High'),
            'MEDIUM': t('coachPage.micro.enums.priority.medium', 'Medium'),
            'LOW': t('coachPage.micro.enums.priority.low', 'Low'),
        };
        return priorityMap[priority] || priority;
    };

    const translateCategory = (category: string) => {
        const categoryMap: Record<string, string> = {
            'TRADING': t('coachPage.micro.enums.category.trading', 'Trading'),
            'DODGING': t('coachPage.micro.enums.category.dodging', 'Dodging'),
            'COOLDOWN_TRACKING': t('coachPage.micro.enums.category.cooldownTracking', 'Cooldown Tracking'),
            'POSITIONING': t('coachPage.micro.enums.category.positioning', 'Positioning'),
            'COMBO': t('coachPage.micro.enums.category.combo', 'Combo'),
            'RESOURCE_MANAGEMENT': t('coachPage.micro.enums.category.resourceManagement', 'Resource Management'),
            'WAVE_CONTROL': t('coachPage.micro.enums.category.waveControl', 'Wave Control'),
        };
        return categoryMap[category] || category;
    };

    const translateScore = (score: string) => {
        const scoreMap: Record<string, string> = {
            'EXCELLENT': t('coachPage.micro.enums.score.excellent', 'Excellent'),
            'GOOD': t('coachPage.micro.enums.score.good', 'Good'),
            'NEEDS_WORK': t('coachPage.micro.enums.score.needsWork', 'Needs Work'),
            'RISKY': t('coachPage.micro.enums.score.risky', 'Risky'),
            'POOR': t('coachPage.micro.enums.score.poor', 'Poor'),
        };
        return scoreMap[score] || score;
    };

    const translateSkillLevel = (level: string) => {
        const levelMap: Record<string, string> = {
            'BEGINNER': t('coachPage.micro.enums.skillLevel.beginner', 'Beginner'),
            'INTERMEDIATE': t('coachPage.micro.enums.skillLevel.intermediate', 'Intermediate'),
            'ADVANCED': t('coachPage.micro.enums.skillLevel.advanced', 'Advanced'),
        };
        return levelMap[level] || level;
    };

    const enhanced = result.enhanced;

    // If no enhanced data, show legacy format
    if (!enhanced) {
        return (
            <div className="space-y-4">
                <div className="bg-slate-950 p-4 rounded border border-slate-700">
                    <h4 className="font-bold text-white mb-2 border-b border-slate-800 pb-2">
                        {t('coachPage.micro.reportTitle', '分析結果レポート')}
                    </h4>
                    <div className="space-y-4">
                        <div>
                            <h5 className="text-xs font-bold text-purple-400 mb-1">{t('coachPage.micro.summary', '要約')}</h5>
                            <p className="text-sm text-slate-300 leading-relaxed">{result.summary}</p>
                        </div>
                        <div>
                            <h5 className="text-xs font-bold text-red-400 mb-1">{t('coachPage.micro.mistakes', '指摘事項')}</h5>
                            <ul className="space-y-2">
                                {result.mistakes.map((mk, idx) => (
                                    <li key={idx} className="text-sm text-slate-300 bg-slate-900/50 p-2 rounded border-l-2 border-red-500">
                                        <span className="font-bold text-red-300">[{mk.timestamp}] {mk.title}</span><br/>
                                        {mk.advice}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {result.finalAdvice && (
                            <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded">
                                <h5 className="text-xs font-bold text-blue-400 mb-1">{t('coachPage.micro.finalAdvice', '総評')}</h5>
                                <p className="text-sm text-slate-300">{result.finalAdvice}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fadeIn">
            {/* Header with Grade */}
            <div className="flex items-center justify-between bg-slate-950 p-4 rounded-lg border border-slate-700">
                <div>
                    <h4 className="font-bold text-white text-lg">{t('coachPage.micro.reportTitle', '分析結果レポート')}</h4>
                    <p className="text-sm text-slate-400">
                        {enhanced.championContext.championName} ({enhanced.championContext.role})
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Skill Level Badge */}
                    <div className="px-3 py-1 rounded-full bg-slate-800 text-xs font-medium text-slate-300">
                        {translateSkillLevel(enhanced.skillLevel)}
                    </div>
                    {/* Grade */}
                    <div className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl font-bold ${gradeColors[enhanced.overallGrade]}`}>
                        {enhanced.overallGrade}
                    </div>
                </div>
            </div>

            {/* Summary */}
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                <p className="text-sm text-slate-300 leading-relaxed">{result.summary}</p>
            </div>

            {/* Situation Snapshot */}
            <div className="bg-slate-950 rounded-lg border border-slate-700 overflow-hidden">
                <button
                    onClick={() => toggleSection('situation')}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-900/50 transition"
                >
                    <h5 className="font-bold text-white flex items-center gap-2">
                        <span className="text-purple-400">📊</span>
                        {t('coachPage.micro.situationSnapshot', '状況スナップショット')}
                        <span className="text-xs text-slate-500">@ {enhanced.situationSnapshot.gameTime}</span>
                    </h5>
                    {expandedSections.situation ? <FaChevronUp className="text-slate-400" /> : <FaChevronDown className="text-slate-400" />}
                </button>

                {expandedSections.situation && (
                    <div className="p-4 border-t border-slate-800">
                        <div className="grid grid-cols-2 gap-4">
                            {/* My Status */}
                            <div className="bg-blue-900/20 p-3 rounded-lg border border-blue-500/30">
                                <h6 className="text-xs font-bold text-blue-400 mb-2">{t('coachPage.micro.myStatus', '自分')}</h6>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">HP</span>
                                        <span className={`font-medium ${enhanced.situationSnapshot.myStatus.hpPercent > 50 ? 'text-green-400' : 'text-red-400'}`}>
                                            {enhanced.situationSnapshot.myStatus.hpPercent}%
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Mana</span>
                                        <span className={`font-medium ${enhanced.situationSnapshot.myStatus.manaPercent > 30 ? 'text-blue-400' : 'text-orange-400'}`}>
                                            {enhanced.situationSnapshot.myStatus.manaPercent}%
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Lv</span>
                                        <span className="text-white font-medium">{enhanced.situationSnapshot.myStatus.level}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Ult</span>
                                        <span>{enhanced.situationSnapshot.myStatus.ultimateReady === true ? '✓' : enhanced.situationSnapshot.myStatus.ultimateReady === false ? '✗' : '?'}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        {enhanced.situationSnapshot.myStatus.keyAbilitiesReady}
                                    </div>
                                </div>
                            </div>

                            {/* Enemy Status */}
                            <div className="bg-red-900/20 p-3 rounded-lg border border-red-500/30">
                                <h6 className="text-xs font-bold text-red-400 mb-2">{t('coachPage.micro.enemyStatus', '相手')}</h6>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">HP</span>
                                        <span className={`font-medium ${enhanced.situationSnapshot.enemyStatus.hpPercent > 50 ? 'text-green-400' : 'text-red-400'}`}>
                                            {enhanced.situationSnapshot.enemyStatus.hpPercent}%
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Mana</span>
                                        <span className={`font-medium ${enhanced.situationSnapshot.enemyStatus.manaPercent > 30 ? 'text-blue-400' : 'text-orange-400'}`}>
                                            {enhanced.situationSnapshot.enemyStatus.manaPercent}%
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Lv</span>
                                        <span className="text-white font-medium">{enhanced.situationSnapshot.enemyStatus.level}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Ult</span>
                                        <span>{enhanced.situationSnapshot.enemyStatus.ultimateReady === true ? '✓' : enhanced.situationSnapshot.enemyStatus.ultimateReady === false ? '✗' : '?'}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        {enhanced.situationSnapshot.enemyStatus.keyAbilitiesReady}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Environment */}
                        <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
                            <h6 className="text-xs font-bold text-slate-400 mb-2">{t('coachPage.micro.environment', '環境')}</h6>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <span className="text-slate-500">Minions:</span>{' '}
                                    <span className="text-slate-300">{enhanced.situationSnapshot.environment.minionAdvantage}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500">Wave:</span>{' '}
                                    <span className="text-slate-300">{enhanced.situationSnapshot.environment.wavePosition}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500">JG Threat:</span>{' '}
                                    <span className="text-slate-300">{enhanced.situationSnapshot.environment.junglerThreat}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500">Vision:</span>{' '}
                                    <span className="text-slate-300">{enhanced.situationSnapshot.environment.visionControl}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Trade Analysis */}
            <div className="bg-slate-950 rounded-lg border border-slate-700 overflow-hidden">
                <button
                    onClick={() => toggleSection('trade')}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-900/50 transition"
                >
                    <h5 className="font-bold text-white flex items-center gap-2">
                        <span className="text-orange-400">⚔️</span>
                        {t('coachPage.micro.tradeAnalysis', 'トレード分析')}
                        {enhanced.tradeAnalysis.tradeOccurred && (
                            <span className={`text-sm font-bold ${outcomeColors[enhanced.tradeAnalysis.outcome]}`}>
                                {translateOutcome(enhanced.tradeAnalysis.outcome)}
                            </span>
                        )}
                    </h5>
                    {expandedSections.trade ? <FaChevronUp className="text-slate-400" /> : <FaChevronDown className="text-slate-400" />}
                </button>

                {expandedSections.trade && (
                    <div className="p-4 border-t border-slate-800 space-y-3">
                        {enhanced.tradeAnalysis.tradeOccurred ? (
                            <>
                                {/* HP Exchange */}
                                <div className="flex items-center gap-4">
                                    <div className="flex-1 p-3 bg-green-900/20 rounded border border-green-500/30 text-center">
                                        <div className="text-xs text-slate-400">{t('coachPage.micro.damageGiven', '与ダメージ')}</div>
                                        <div className="text-lg font-bold text-green-400">{enhanced.tradeAnalysis.hpExchanged.damageGiven}</div>
                                    </div>
                                    <div className="text-slate-500">vs</div>
                                    <div className="flex-1 p-3 bg-red-900/20 rounded border border-red-500/30 text-center">
                                        <div className="text-xs text-slate-400">{t('coachPage.micro.damageTaken', '被ダメージ')}</div>
                                        <div className="text-lg font-bold text-red-400">{enhanced.tradeAnalysis.hpExchanged.damageTaken}</div>
                                    </div>
                                </div>

                                {/* Reason */}
                                <div className="p-3 bg-slate-800/50 rounded">
                                    <div className="text-xs text-slate-400 mb-1">{t('coachPage.micro.reason', '理由')}</div>
                                    <p className="text-sm text-slate-300">{enhanced.tradeAnalysis.reason}</p>
                                </div>

                                {/* Cooldown Context */}
                                {enhanced.tradeAnalysis.cooldownContext && (
                                    <div className="p-3 bg-yellow-900/20 rounded border border-yellow-500/30">
                                        <div className="text-xs text-yellow-400 mb-1">💡 {t('coachPage.micro.cooldownContext', 'CD状況')}</div>
                                        <p className="text-sm text-slate-300">{enhanced.tradeAnalysis.cooldownContext}</p>
                                    </div>
                                )}

                                {/* Optimal Action */}
                                <div className="p-3 bg-blue-900/20 rounded border border-blue-500/30">
                                    <div className="text-xs text-blue-400 mb-1">→ {t('coachPage.micro.optimalAction', '最適な行動')}</div>
                                    <p className="text-sm text-slate-300">{enhanced.tradeAnalysis.optimalAction}</p>
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-slate-400">{t('coachPage.micro.noTrade', 'このクリップではトレードが発生していません')}</p>
                        )}
                    </div>
                )}
            </div>

            {/* Mechanics Evaluation */}
            <div className="bg-slate-950 rounded-lg border border-slate-700 overflow-hidden">
                <button
                    onClick={() => toggleSection('mechanics')}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-900/50 transition"
                >
                    <h5 className="font-bold text-white flex items-center gap-2">
                        <span className="text-cyan-400">🎯</span>
                        {t('coachPage.micro.mechanicsEvaluation', 'メカニクス評価')}
                    </h5>
                    {expandedSections.mechanics ? <FaChevronUp className="text-slate-400" /> : <FaChevronDown className="text-slate-400" />}
                </button>

                {expandedSections.mechanics && (
                    <div className="p-4 border-t border-slate-800 space-y-4">
                        {/* Skills Used */}
                        {enhanced.mechanicsEvaluation.skillsUsed.length > 0 && (
                            <div>
                                <h6 className="text-xs font-bold text-slate-400 mb-2">{t('coachPage.micro.skillsUsed', 'スキル使用')}</h6>
                                <div className="space-y-2">
                                    {enhanced.mechanicsEvaluation.skillsUsed.map((skill, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-2 bg-slate-800/50 rounded">
                                            <span className="font-bold text-white w-8">{skill.skill}</span>
                                            {skill.hit === true ? (
                                                <FaCheckCircle className="text-green-400" />
                                            ) : skill.hit === false ? (
                                                <FaTimesCircle className="text-red-400" />
                                            ) : (
                                                <FaQuestionCircle className="text-slate-400" />
                                            )}
                                            <span className={`text-xs px-2 py-0.5 rounded ${
                                                skill.timing === 'PERFECT' ? 'bg-yellow-500/20 text-yellow-400' :
                                                skill.timing === 'GOOD' ? 'bg-green-500/20 text-green-400' :
                                                skill.timing === 'EARLY' || skill.timing === 'LATE' ? 'bg-orange-500/20 text-orange-400' :
                                                'bg-red-500/20 text-red-400'
                                            }`}>
                                                {translateTiming(skill.timing)}
                                            </span>
                                            <span className="text-xs text-slate-400 flex-1">{skill.note}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Skills Dodged */}
                        {enhanced.mechanicsEvaluation.skillsDodged.length > 0 && (
                            <div>
                                <h6 className="text-xs font-bold text-slate-400 mb-2">{t('coachPage.micro.skillsDodged', 'スキル回避')}</h6>
                                <div className="space-y-2">
                                    {enhanced.mechanicsEvaluation.skillsDodged.map((dodge, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-2 bg-slate-800/50 rounded">
                                            <span className="text-sm text-slate-300">{dodge.enemySkill}</span>
                                            {dodge.dodged ? (
                                                <FaCheckCircle className="text-green-400" />
                                            ) : (
                                                <FaTimesCircle className="text-red-400" />
                                            )}
                                            <span className="text-xs text-slate-400">{dodge.method}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded ml-auto ${
                                                dodge.difficulty === 'EASY' ? 'bg-green-500/20 text-green-400' :
                                                dodge.difficulty === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-red-500/20 text-red-400'
                                            }`}>
                                                {translateDifficulty(dodge.difficulty)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Summary Stats */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="p-2 bg-slate-800/50 rounded text-center">
                                <div className="text-xs text-slate-400">{t('coachPage.micro.aaWeaving', 'AA Weaving')}</div>
                                <div className={`font-bold text-sm ${
                                    enhanced.mechanicsEvaluation.autoAttackWeaving === 'EXCELLENT' ? 'text-yellow-400' :
                                    enhanced.mechanicsEvaluation.autoAttackWeaving === 'GOOD' ? 'text-green-400' :
                                    enhanced.mechanicsEvaluation.autoAttackWeaving === 'NEEDS_WORK' ? 'text-orange-400' :
                                    'text-red-400'
                                }`}>
                                    {translateScore(enhanced.mechanicsEvaluation.autoAttackWeaving)}
                                </div>
                            </div>
                            <div className="p-2 bg-slate-800/50 rounded text-center">
                                <div className="text-xs text-slate-400">{t('coachPage.micro.positioning', 'Positioning')}</div>
                                <div className={`font-bold text-sm ${
                                    enhanced.mechanicsEvaluation.positioningScore === 'EXCELLENT' ? 'text-yellow-400' :
                                    enhanced.mechanicsEvaluation.positioningScore === 'GOOD' ? 'text-green-400' :
                                    enhanced.mechanicsEvaluation.positioningScore === 'RISKY' ? 'text-orange-400' :
                                    'text-red-400'
                                }`}>
                                    {translateScore(enhanced.mechanicsEvaluation.positioningScore)}
                                </div>
                            </div>
                            <div className="p-2 bg-slate-800/50 rounded text-center">
                                <div className="text-xs text-slate-400">{t('coachPage.micro.combo', 'Combo')}</div>
                                <div className="font-bold text-sm text-slate-300 truncate" title={enhanced.mechanicsEvaluation.comboExecution}>
                                    {enhanced.mechanicsEvaluation.comboExecution.substring(0, 10)}...
                                </div>
                            </div>
                        </div>

                        {/* Positioning Note */}
                        {enhanced.mechanicsEvaluation.positioningNote && (
                            <div className="p-3 bg-slate-800/50 rounded">
                                <p className="text-sm text-slate-300">{enhanced.mechanicsEvaluation.positioningNote}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Improvements */}
            <div className="bg-slate-950 rounded-lg border border-slate-700 overflow-hidden">
                <button
                    onClick={() => toggleSection('improvements')}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-900/50 transition"
                >
                    <h5 className="font-bold text-white flex items-center gap-2">
                        <span className="text-green-400">📝</span>
                        {t('coachPage.micro.improvements', '改善ポイント')}
                        <span className="text-xs text-slate-500">({enhanced.improvements.length})</span>
                    </h5>
                    {expandedSections.improvements ? <FaChevronUp className="text-slate-400" /> : <FaChevronDown className="text-slate-400" />}
                </button>

                {expandedSections.improvements && (
                    <div className="p-4 border-t border-slate-800 space-y-3">
                        {enhanced.improvements.map((imp, idx) => (
                            <div key={idx} className={`p-4 rounded-lg border ${priorityColors[imp.priority]}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${priorityColors[imp.priority]}`}>
                                            {translatePriority(imp.priority)}
                                        </span>
                                        <span className="text-xs text-slate-400">{translateCategory(imp.category)}</span>
                                        {imp.championSpecific && (
                                            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                                                {enhanced.championContext.championName}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <h6 className="font-bold text-white mb-2">{imp.title}</h6>
                                <div className="space-y-2 text-sm">
                                    <div>
                                        <span className="text-red-400">✗ {t('coachPage.micro.current', '現在')}: </span>
                                        <span className="text-slate-300">{imp.currentBehavior}</span>
                                    </div>
                                    <div>
                                        <span className="text-green-400">✓ {t('coachPage.micro.ideal', '理想')}: </span>
                                        <span className="text-slate-300">{imp.idealBehavior}</span>
                                    </div>
                                    <div className="p-2 bg-slate-800/50 rounded">
                                        <span className="text-blue-400">💡 {t('coachPage.micro.practice', '練習')}: </span>
                                        <span className="text-slate-300">{imp.practice}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Champion Context */}
            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 p-4 rounded-lg border border-purple-500/30">
                <h5 className="font-bold text-white mb-2 flex items-center gap-2">
                    <span>🎮</span>
                    {enhanced.championContext.championName} {t('coachPage.micro.tips', 'Tips')}
                </h5>
                <p className="text-sm text-slate-300 mb-2">{enhanced.championContext.playstyleAdvice}</p>
                <div className="p-2 bg-slate-900/50 rounded">
                    <span className="text-xs text-slate-400">{t('coachPage.micro.keyCombo', 'Key Combo')}: </span>
                    <span className="text-sm font-mono text-yellow-400">{enhanced.championContext.keyCombo}</span>
                </div>
            </div>

            {/* Final Advice */}
            {result.finalAdvice && (
                <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                    <h5 className="text-sm font-bold text-blue-400 mb-2">{t('coachPage.micro.finalAdvice', '総評')}</h5>
                    <p className="text-sm text-slate-300">{result.finalAdvice}</p>
                </div>
            )}

            {/* Re-analyze Button */}
            {onReanalyze && (
                <div className="text-right">
                    <button
                        onClick={onReanalyze}
                        className="text-xs text-slate-400 hover:text-white underline"
                    >
                        {t('coachPage.micro.analyzeAnother', '別のシーンを分析')}
                    </button>
                </div>
            )}
        </div>
    );
}
