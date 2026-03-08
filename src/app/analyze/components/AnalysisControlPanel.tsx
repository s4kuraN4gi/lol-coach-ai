"use client";

import Link from "next/link";
import { FaMapMarkerAlt, FaSearch } from "react-icons/fa";
import { useTranslation } from "@/contexts/LanguageContext";
import TurnstileWidget from "@/app/components/TurnstileWidget";

interface CreditInfo {
    canAnalyze: boolean;
    isGuest: boolean;
    credits: number;
    maxCredits: number;
    nextCreditAt: Date | null;
    upgradeMessage?: string;
    isPremium?: boolean;
}

interface AnalysisControlPanelProps {
    analysisMode: 'macro' | 'micro';
    creditInfo: CreditInfo | null;
    videoFile: File | null;
    analyzing: boolean;
    isLoading: boolean;
    progress: number;
    progressMsg: string;
    error: string | null;
    onErrorDismiss: () => void;
    onRunAnalysis: () => void;
    onTurnstileVerify: (token: string) => void;
    onTurnstileExpire: () => void;
}

export default function AnalysisControlPanel({
    analysisMode,
    creditInfo,
    videoFile,
    analyzing,
    isLoading,
    progress,
    progressMsg,
    error,
    onErrorDismiss,
    onRunAnalysis,
    onTurnstileVerify,
    onTurnstileExpire,
}: AnalysisControlPanelProps) {
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            {/* Error Display */}
            {error && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                    <p className="text-red-300 text-sm">{error}</p>
                    <button
                        onClick={onErrorDismiss}
                        className="text-xs text-red-400 mt-2 hover:text-red-300"
                    >
                        {t('analyzePage.segments.close')}
                    </button>
                </div>
            )}

            {/* Analysis Card */}
            <div className={`bg-slate-900 border rounded-xl p-6 ${
                analysisMode === 'macro' ? 'border-emerald-500/30' : 'border-purple-500/30'
            }`}>
                <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${
                    analysisMode === 'macro' ? 'text-emerald-400' : 'text-purple-400'
                }`}>
                    {analysisMode === 'macro' ? <FaMapMarkerAlt /> : <FaSearch />}
                    {analysisMode === 'macro'
                        ? t('analyzePage.analysis.macroTitle')
                        : t('analyzePage.tabs.micro')}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                        analysisMode === 'macro'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-purple-500/20 text-purple-300'
                    }`}>
                        AI
                    </span>
                </h2>

                {/* Progress */}
                {analyzing && (
                    <div className="mb-4">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>{progressMsg}</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full transition-all duration-300 ${
                                    analysisMode === 'macro' ? 'bg-emerald-500' : 'bg-purple-500'
                                }`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Credit Warning */}
                {creditInfo && !creditInfo.canAnalyze && (
                    <div className="mb-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                        <p className="text-slate-300 text-sm mb-3">
                            {creditInfo.isGuest
                                ? t('analyzePage.analysis.guestNoCredits')
                                : t('analyzePage.analysis.weeklyLimit')}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            {creditInfo.isGuest ? (
                                <>
                                    <Link
                                        href="/signup"
                                        className="flex-1 py-2 text-center bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition"
                                    >
                                        {t('analyzePage.analysis.freeRegister')}
                                    </Link>
                                    <Link
                                        href="/pricing"
                                        className="flex-1 py-2 text-center text-slate-400 hover:text-white text-sm border border-slate-600 rounded-lg transition"
                                    >
                                        {t('analyzePage.analysis.comparePlans')}
                                    </Link>
                                </>
                            ) : (
                                <Link
                                    href="/pricing"
                                    className="py-2 px-4 text-center text-slate-400 hover:text-white text-sm transition"
                                >
                                    {t('analyzePage.analysis.viewPlans')}
                                </Link>
                            )}
                        </div>
                    </div>
                )}

                {/* Turnstile CAPTCHA for guest users */}
                {creditInfo?.isGuest && (
                    <TurnstileWidget
                        onVerify={onTurnstileVerify}
                        onExpire={onTurnstileExpire}
                        className="flex justify-center"
                    />
                )}

                {/* Analysis Button */}
                <button
                    onClick={onRunAnalysis}
                    disabled={!videoFile || analyzing || isLoading || !creditInfo?.canAnalyze}
                    className={`w-full py-3 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 ${
                        !videoFile || analyzing || isLoading || !creditInfo?.canAnalyze
                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                            : analysisMode === 'macro'
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                    }`}
                >
                    {analysisMode === 'macro' ? <FaMapMarkerAlt /> : <FaSearch />}
                    {isLoading ? t('analyzePage.buttons.loading') :
                     analyzing ? t('analyzePage.buttons.analyzing') :
                     !videoFile ? t('analyzePage.buttons.selectVideo') :
                     !creditInfo?.canAnalyze ? t('analyzePage.buttons.noCredits') :
                     t('analyzePage.buttons.startAnalysis').replace('{credits}', String(creditInfo?.credits ?? 0))}
                </button>
            </div>
        </div>
    );
}
