"use client";

import { useEffect, useState } from "react";
import Display from "../Display";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";


export default function LoginPage() {
  const router = useRouter();
  const [LoginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  //ログイン画面に遷移した時にサモナーネームの入力値を削除
  useEffect(() => {
    localStorage.removeItem("LoginID");
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!LoginId.trim() || !password.trim()) {
      alert("ログインIDとパスワードを入力してください");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: LoginId.trim(),
      password: password,
    });

    if (error) {
      alert("ログイン失敗："+ error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    setLoading(false);
  };
  return (
    <main className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <Display />

        <form onSubmit={handleLogin} className="space-y-4">
          {/* サモナーネーム入力欄 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス：
            </label>
            <input
              type="text"
              onChange={(e) => setLoginId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 focus:ring focus:ring-blue-200"
              placeholder="メールアドレス"
            />
          </div>
          {/* パスワード入力欄 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード：
            </label>
            <input
              type="password"
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-md px-3 py-2 focus:ring focus:ring-blue-200"
              placeholder="パスワード"
            />
          </div>
          {/* ログインボタン */}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-semibold py-2 mt-2 rounded-mb hover:bg-blue-700 transition"
            disabled={loading}
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        {/* アカウント誘導 */}
        <p className="text-center text-sm text-gray-600 mt-4">
          アカウントをお持ちでない方は{" "}
          <a href="/signup" className="text-blue-600 hover:underline">
            登録
          </a>
        </p>

        <p className="text-center text-sm text-gray-600 mt-4">
            <a href="/react-password" className="text-blue-600 hover:underline">
              パスワードをお忘れですか？
            </a>
        </p>
      </div>
    </main>
  );
}
