

type HistoryItem = {
  id: string;
  date: string;
  selectedSummoner: string;
  champion: string;
  role: string;
  result: string;
  kda: string;
  aiAdvice: string;
};

type props = {
  histories: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  selectedHistory: HistoryItem | null;
};


export default function HistoryList({histories, onSelect, selectedHistory}: props) {
    
    //履歴データが存在しない場合
    if(!histories || histories.length === 0){
        return(
            <div className="text-gray-500 text-sm text-center py-4">
                履歴はまだありません
            </div>
        );
    }

    // 履歴データが存在する場合
  return (
    <div className="space-y-3">
        {histories.map((item) => {
            const isWin = item.result === "Win";
            const borderColor = isWin ? "border-blue-500/50" : "border-red-500/50";
            const bgColor = isWin ? "bg-blue-900/20" : "bg-red-900/20";
            const textResultColor = isWin ? "text-blue-300" : "text-red-300";
            const isSelected = selectedHistory?.id === item.id;

            return (
                <div
                    key={item.id}
                    onClick={() => onSelect(item)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 relative overflow-hidden group
                    ${borderColor} ${bgColor}
                    ${isSelected ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.3)] scale-[1.02]' : 'hover:scale-[1.01] hover:bg-opacity-40'}
                    `}
                >
                    {/* Background Gradient Hover */}
                    <div className={`absolute inset-0 bg-gradient-to-r ${isWin ? 'from-blue-600/10' : 'from-red-600/10'} to-transparent opacity-0 group-hover:opacity-100 transition duration-300 pointer-events-none`}></div>

                    <div className="flex justify-between items-center relative z-10">
                        <div>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-lg font-bold ${item.selectedSummoner ? 'text-slate-200' : ''}`}>{item.champion}</span>
                                <span className="text-xs text-slate-400 font-mono tracking-wider">{item.role}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">{item.date}</div>
                        </div>
                        
                        <div className="text-right">
                            <div className={`text-lg font-black italic tracking-wider ${textResultColor}`}>
                                {isWin ? "VICTORY" : "DEFEAT"}
                            </div>
                            <div className="text-sm font-mono text-slate-300 mt-0.5">
                                KDA <span className="text-white font-bold">{item.kda}</span>
                            </div>
                        </div>
                    </div>
                </div>
            );
        })}
    </div>
  )
}
