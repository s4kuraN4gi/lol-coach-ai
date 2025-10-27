

type HistoryItem = {
  id: string;
  date: string;
  summonerName: string;
  champion: string;
  role: string;
  result: string;
  kda: string;
  aiAdvice: string;
};

type props = {
  histories: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
};


export default function HistoryList({histories, onSelect}: props) {
    
    //履歴データが存在しない場合
    if(!histories || histories.length === 0){
        return(
            <div className="text-gray-500 text-sm text-center py-4">
                履歴はまだありません
            </div>
        );
    }

    //履歴データが存在する場合
  return (
    <div className="space-y2">
        {histories.map((item) => (
            <div
                key={item.id}
                onClick={() => onSelect(item)}
                className="p-3 bg-white border rounded-mb cursor-pointer hover:bg-gray-100"
            >
                <p className="font-medium">{item.summonerName}({item.champion})</p>
                <p className="text-sm text-gray-500">{item.date}</p>
                <p className="text-sm text-gray-600">{item.role} | {item.result} | {item.kda}</p>
            </div>
        ))}
    </div>
  )
}
