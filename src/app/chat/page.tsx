"use client";

import { useEffect, useRef, useState } from "react";
import { getAnalysisStatus, type AnalysisStatus } from "@/app/actions/analysis";
import DashboardLayout from "../Components/layout/DashboardLayout";
import LoadingAnimation from "../Components/LoadingAnimation";
import PremiumFeatureGate from "../Components/subscription/PremiumFeatureGate";
import { useSummoner } from "../Providers/SummonerProvider";
import { useRouter } from "next/navigation";

const CHAT_KEY = "chat:message";

// チャットメッセージの型
type ChatMsg = {
  role: "user" | "ai";
  text: string;
  ts: number;
};

// チャットセッションの型
type ChatSession = {
  id: string;
  title: string;
  message: ChatMsg[];
};

export default function ChatPage() {
  const {activeSummoner, loading} = useSummoner();
  const router = useRouter();

  // Premium Status State
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // user又はaiがロールのメッセージの状態管理
  const [message, setMessage] = useState<
    { role: "user" | "ai"; text: string }[]
  >([]);

  //   AIメッセージの状態管理
  const [input, setInput] = useState("");
  //   ローディング状態管理
  const [loadingAI, setLoadingAI] = useState(false);
  //   セッションの状態管理
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  //   選択中のセッションの状態管理
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(
    null
  );
//   自動スクロール用
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch Premium Status
  useEffect(() => {
    getAnalysisStatus().then((status) => {
        setAnalysisStatus(status);
        setLoadingStatus(false);
    });
  }, []);

  // 初期表示時
  useEffect(() => {
    if(!activeSummoner) return;

    const key = `chatSessions_${activeSummoner.summoner_name}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
      } catch {
        console.warn("履歴の読み込みに失敗しました。");
      }
    }
  }, [activeSummoner]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth"})
  },[selectedSession?.message])

  // NOTE: Early return must be AFTER all hooks are defined to avoid React Error #310
  if (loading || loadingStatus) {
     return (
        <DashboardLayout>
            <div className="flex items-center justify-center min-h-[60vh]">
                <LoadingAnimation />
            </div>
        </DashboardLayout>
     )
  }

  // 送信ボタン押下処理
  const handleSubmit = async (e: React.FormEvent) => {
    const key = `chatSessions_${activeSummoner?.summoner_name}`;
    // 送信処理を止める
    e.preventDefault();
    if (!input.trim()) return;
    // ユーザーメッセージを { role: "user", text: 入力値, ts: 現在時刻 } としてオブジェクト定義
    const userMsg = { role: "user" as const, text: input, ts: Date.now() };
    // ChatSession型としてlocalStrageの”chatSession"から取得したリストをallSessionとして定義
    const allSessions: ChatSession[] = JSON.parse(
      localStorage.getItem(key) || "[]"
    );

    // 現在のセッションをChatSession型として定義
    let currentSession: ChatSession;

    if (!selectedSession) {
      // 新規チャット作成
      currentSession = {
        id: crypto.randomUUID(),
        title: input.slice(0, 20),
        message: [userMsg],
      };
      //   allSessionsの先頭に現在のセッションを追加
      allSessions.unshift(currentSession);
    } else {
      // 既存のチャット更新
      // タイトルが新しいチャットだった場合に最初の入力で更新
      const newTitle =
        selectedSession.title === "新しいチャット"
          ? input.slice(0, 20)
          : selectedSession.title;

      //   現在のセッションをコピーし、タイトルを上書きしてuserMsgの型を追加、新オブジェクトの生成
      currentSession = {
        ...selectedSession,
        title: newTitle,
        message: [...selectedSession.message, userMsg],
      };

      const idx = allSessions.findIndex((s) => s.id === selectedSession.id);
      allSessions[idx] = currentSession;
    }

    // filterで履歴の先頭に最新の履歴を表示
    const filtered = allSessions.filter((s) => s.id !== currentSession.id);
    const updatedSessions = [currentSession, ...filtered];

    localStorage.setItem(key, JSON.stringify(allSessions));
    setSessions(updatedSessions);
    setSelectedSession(currentSession);
    setMessage(currentSession.message);
    setInput("");
    setLoadingAI(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `AIエラー: ${res.status}`);
      }

      const aiMsg = {
        role: "ai" as const,
        text: data.advice ?? "AIからの返答がありません。",
        ts: Date.now(),
      };
      //   全ての履歴を取得
      const allSessions: ChatSession[] = JSON.parse(
        localStorage.getItem(key) || "[]"
      );
      //   最新の履歴を取得
      const latestSession = allSessions.find(
        (s) => s.id === selectedSession?.id
      );
      if (!latestSession) return;

      //   AIのメッセージを追加
      const updatedSession: ChatSession = {
        ...latestSession,
        message: [...latestSession.message, aiMsg],
      };

      //   filterで最新の履歴意外を定義した後、先頭に最新の履歴を追加
      const filtered = allSessions.filter((s) => s.id !== updatedSession.id);
      const updatedSessions = [updatedSession, ...filtered];

      //   保存と再レンダリング
      localStorage.setItem(key, JSON.stringify(updatedSessions));
      setSessions(updatedSessions);
      setSelectedSession(updatedSession);
      setMessage(updatedSession.message);
    } catch (err: any) {
      console.log("AI接続エラー:", err);
      const errMsg = err.message || "AIとの通信に失敗しました。";
      setMessage((prev) => [
        ...prev,
        { role: "ai", text: `⚠️ ${errMsg}` },
      ]);
    } finally {
      setLoadingAI(false);
    }
  };

  // 履歴全削除ボタン処理
  const handleClearHistory = () => {
    if (confirm("本当に削除しますか？")) {
      localStorage.removeItem(`chatSessions_${activeSummoner?.summoner_name}`);
      setSessions([]);
      setSelectedSession(null);
      setMessage([]);
    }
  };

  return (
    //{/* ナビゲーションエリア */}
    <DashboardLayout>
      <PremiumFeatureGate
        isPremium={analysisStatus?.is_premium ?? false}
        title="AI Coaching Chat"
        description="Chat with our advanced AI Coach to get personalized advice, build discussions, and improve your game knowledge."
      >
      <div className="flex h-[85vh] gap-6">
        <aside className="w-72 glass-panel p-4 flex flex-col rounded-xl overflow-hidden border border-slate-700/50">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <span className="text-xl">💬</span> HISTORY
            </h3>

            {/* 全削除ボタン */}
            <button
              onClick={handleClearHistory}
              className="text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 px-2 py-1 rounded transition"
            >
              CLEAR ALL
            </button>
          </div>

          {/* 新規チャット作成ボタン */}
          <button
            onClick={() => {
              const newSession: ChatSession = {
                id: crypto.randomUUID(),
                title: "新しいチャット",
                message: [],
              };
              const updated = [newSession, ...sessions];
              setSessions(updated);
              setSelectedSession(newSession);
              setMessage([]);
              const key = `chatSessions_${activeSummoner?.summoner_name}`
              localStorage.setItem(key, JSON.stringify(updated));
            }}
            className="mb-6 w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold py-2.5 rounded-lg hover:from-blue-500 hover:to-cyan-500 transition shadow-lg shadow-blue-900/20 active:scale-95 flex items-center justify-center gap-2"
          >
            <span className="text-lg">+</span> NEW CHAT
          </button>

          {/* チャット履歴一覧 */}
          {sessions.length === 0 ? (
            <div className="text-center mt-10 opacity-50">
                <p className="text-4xl mb-2">📜</p>
                <p className="text-slate-400 text-sm">No history yet.</p>
            </div>
          ) : (
            <ul className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-1">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  onClick={() => {
                    setSelectedSession(s);
                    setMessage(s.message);
                  }}
                  className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border border-transparent ${
                    selectedSession?.id === s.id 
                    ? "bg-blue-600/20 border-blue-500/30 text-blue-100" 
                    : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span className="flex-1 truncate text-sm font-medium">
                    {s.title}
                  </span>
                  {/* 削除ボタン */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); //チャットの選択イベントを阻止
                      if (confirm(`「${s.title}」を削除しますか？`)) {
                        const updated = sessions.filter(
                          (chat) => chat.id !== s.id
                        );
                        const key = `chatSessions_${activeSummoner?.summoner_name}`
                        localStorage.setItem(
                          key,
                          JSON.stringify(updated)
                        );
                        setSessions(updated);

                        if (selectedSession?.id === s.id) {
                          setSelectedSession(null);
                          setMessage([]);
                        }
                      }
                    }}
                    className="text-slate-600 group-hover:text-red-400 opacity-0 group-hover:opacity-100 transition p-1 hover:bg-slate-700 rounded"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* チャット画面 */}
        <section className="flex-1 flex flex-col h-full glass-panel rounded-xl border border-slate-700/50 overflow-hidden relative">
          
          {/* Background decoration */}
           <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-5 pointer-events-none"></div>

          <div className="w-full flex-1 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar z-10">
            {selectedSession ? (
              <>
                {selectedSession?.message.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl max-w-[85%] shadow-md leading-relaxed ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white self-end rounded-br-none"
                        : "bg-slate-800/80 text-slate-200 self-start rounded-bl-none border border-slate-700"
                    }`}
                  >
                    <p className={`text-xs font-bold mb-1 opacity-50 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                        {msg.role === 'user' ? 'YOU' : 'AI COACH'}
                    </p>
                    {msg.text.split("\n").map((line,i) => (
                        <span key={i} className="block min-h-[1.2em]">
                            {line}
                        </span>
                    ))}
                  </div>
                ))}
                {/* 👇 ローディング表示 */}
                {loadingAI && (
                  <div className="self-start p-4 bg-slate-800/50 rounded-xl rounded-bl-none border border-slate-700 flex items-center gap-3 animate-pulse">
                     <span className="text-2xl animate-spin">🤖</span>
                     <span className="text-slate-400 text-sm font-bold">AI IS THINKING...</span>
                  </div>
                )}
                {/* 自動スクロール用ダミー要素 */}
                <div ref={messagesEndRef} />
              </>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60">
                    <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
                        <span className="text-4xl grayscale">🤖</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-400 mb-2">LOLE COACH AI</h3>
                    <p className="text-sm">Select a chat history or start a new conversation.</p>
                </div>
            )}
          </div>

          {/* 入力フォーム */}
          <div className="p-4 bg-slate-900 border-t border-slate-800 z-20">
            <form
                onSubmit={handleSubmit}
                className="flex gap-3 max-w-4xl mx-auto"
            >
                <textarea
                value={input}
                onKeyDown={(e) => {
                    if(e.nativeEvent.isComposing) return;
                    if(e.key === "Enter" && !e.shiftKey){
                        e.preventDefault();
                        handleSubmit(e)
                    }
                }}
                placeholder="Ask your AI Coach anything..."
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 bg-slate-800 border-slate-700 text-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-500 resize-none transition shadow-inner"
                rows={1}
                disabled={!selectedSession}
                />
                <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-500 transition font-bold shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
                disabled={loadingAI || !input.trim() || !selectedSession}
                >
                SEND
                </button>
            </form>
          </div>
        </section>
      </div>
      </PremiumFeatureGate>
    </DashboardLayout>
  );
}
