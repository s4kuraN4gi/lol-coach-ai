"use client";

import { useEffect, useRef, useState } from "react";
import DashboardLayout from "../Components/layout/DashboardLayout";
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

  const router = useRouter();


  // Layout側でリダイレクト制御されているため、ここでは削除
  // useEffect(() => {
  //   if(loading) return;
  //   if(!activeSummoner) {
  //     router.push("/account");
  //   }
  // },[activeSummoner, router, loading]);

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

      if (!res.ok) throw new Error(`AIエラー: ${res.status}`);
      const data = await res.json();

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
    } catch (err) {
      console.log("AI接続エラー:", err);
      setMessage((prev) => [
        ...prev,
        { role: "ai", text: "⚠️ AIとの通信に失敗しました。" },
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
      <div className="flex h-full">
        <aside className="w-64 bg-gray-100 border-r border-gray-200 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">履歴</h3>

            {/* 全削除ボタン */}
            <button
              onClick={handleClearHistory}
              className="text-sm text-red-500 hover:text-red-600"
            >
              全削除
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
            className="mb-4 w-full bg-blue-500 text-white py-2 rounded-r hover:bg-blue-600 transition"
          >
            + 新しいチャット
          </button>

          {/* チャット履歴一覧 */}
          {sessions.length === 0 ? (
            <p className="text-gray-500 text-sm text-center mt-8">
              チャット履歴はまだありません。
            </p>
          ) : (
            <ul className="space-y-2 flex-1 overflow-y-auto">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className={`flex items-center justify-between p-2 bg-white rounded-lg shadow-sm hover:bg-blue-50 ${
                    selectedSession?.id === s.id ? "bg-blue-100" : ""
                  }`}
                >
                  <span
                    onClick={() => {
                      setSelectedSession(s);
                      setMessage(s.message);
                    }}
                    className="flex-1 cursor-pointer truncate hover:text-blue-600"
                  >
                    {s.title}
                  </span>
                  {/* 削除ボタン */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); //チャットの選択イベントを阻止
                      if (confirm(`「${s.title}を削除しますか？`)) {
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
                    className="text-red-400 hover:text-red-600 transition text-sm ml-2"
                  >
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* チャット画面 */}
        <section className="flex-1 flex flex-col h-full">
          <div className="w-full max-w-2xl flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
            {selectedSession ? (
              <>
                {selectedSession?.message.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg max-w-[75%] ${
                      msg.role === "user"
                        ? "bg-blue-500 text-white self-end"
                        : "bg-gray-200 text-gray-800 self-start"
                    }`}
                  >
                    {msg.text.split("\n").map((line,i) => (
                        <span key={i}>
                            {line}
                            <br />
                        </span>
                    ))}
                  </div>
                ))}
                {/* 👇 ローディング表示 */}
                {loadingAI && (
                  <div className="text-gray-500 text-sm italic self-start animate-pulse">
                    AIが考え中...
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-500 text-center mt-8">
                左の履歴からチャットを選択してください。
              </p>
            )}
          </div>

          {/* 入力フォーム */}
          <form
            onSubmit={handleSubmit}
            className="p-4 bg-white border-t border-gray-200 flex gap-3"
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
              placeholder="AIコーチに質問してみよう..."
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              rows={2}
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
            >
              {loadingAI ? "送信中..." : "送信"}
            </button>
          </form>
        </section>
      </div>
    </DashboardLayout>
  );
}
