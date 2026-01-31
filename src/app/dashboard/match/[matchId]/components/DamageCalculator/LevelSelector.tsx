"use client";

type Props = {
  level: number;
  onChange: (level: number) => void;
};

export default function LevelSelector({ level, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 font-mono w-7">Lv</span>
      <button
        onClick={() => onChange(Math.max(1, level - 1))}
        className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs flex items-center justify-center transition-colors"
        disabled={level <= 1}
      >
        -
      </button>
      <input
        type="range"
        min={1}
        max={20}
        value={level}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
      <button
        onClick={() => onChange(Math.min(20, level + 1))}
        className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs flex items-center justify-center transition-colors"
        disabled={level >= 20}
      >
        +
      </button>
      <span className="text-sm font-bold text-white font-mono w-6 text-center">{level}</span>
    </div>
  );
}
