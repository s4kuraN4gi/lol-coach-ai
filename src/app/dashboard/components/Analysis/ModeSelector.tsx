import React from 'react';
import { AnalysisFocus } from '@/app/actions/coach';

type Mode = 'LANING' | 'MACRO' | 'TEAMFIGHT';

type Props = {
    selectedMode: Mode;
    onSelect: (mode: Mode) => void;
    disabled?: boolean;
};

import { useTranslation } from "@/contexts/LanguageContext";

export function ModeSelector({ selectedMode, onSelect, disabled }: Props) {
    const { t } = useTranslation();
    const modes: { id: Mode; label: string; icon: string; desc: string }[] = [
        { id: 'LANING', label: t('coachPage.modeSelector.LANING.label'), icon: '⚔️', desc: t('coachPage.modeSelector.LANING.desc') },
        { id: 'MACRO', label: t('coachPage.modeSelector.MACRO.label'), icon: '🗺️', desc: t('coachPage.modeSelector.MACRO.desc') },
        { id: 'TEAMFIGHT', label: t('coachPage.modeSelector.TEAMFIGHT.label'), icon: '💥', desc: t('coachPage.modeSelector.TEAMFIGHT.desc') },
    ];

    return (
        <div className="grid grid-cols-3 gap-2 mb-6">
            {modes.map((mode) => (
                <button
                    key={mode.id}
                    onClick={() => onSelect(mode.id)}
                    disabled={disabled}
                    className={`
                        relative px-4 py-3 rounded-xl border transition-all duration-300 group
                        flex flex-col items-center justify-center gap-1
                        ${selectedMode === mode.id 
                            ? 'bg-blue-600/20 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800 hover:border-slate-600'
                        }
                        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                >
                    <div className="text-lg mb-1 group-hover:scale-110 transition-transform">{mode.icon}</div>
                    <span className={`font-bold text-sm ${selectedMode === mode.id ? 'text-blue-200' : ''}`}>
                        {mode.label}
                    </span>
                    <span className="text-[10px] text-slate-500 hidden md:block">
                        {mode.desc}
                    </span>
                </button>
            ))}
        </div>
    );
}
