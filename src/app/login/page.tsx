"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Footer from "../Components/layout/Footer";


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

    const { data, error } = await supabase.auth.signInWithPassword({
      email: LoginId.trim(),
      password: password,
    });

    if (error) {
      alert("ログイン失敗："+ error.message);
      setLoading(false);
      return;
    }

    if (data.user && !data.user.email_confirmed_at) {
        // メール認証未完了の場合
        alert("メール認証が完了していません。\n届いたメール内のリンクをクリックしてください。");
        await supabase.auth.signOut(); // セッションを破棄
        setLoading(false);
        return;
    }

    router.push("/dashboard");
    setLoading(false);
  };
  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 -z-10"></div>
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 pointer-events-none"></div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-800 backdrop-blur-xl relative z-10 transition-all hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]">
            <div className="mb-6 text-center">
                <h1 className="text-3xl font-black text-foreground tracking-tighter mb-2">
                    LoL Coach AI
                </h1>
                <p className="text-slate-400 text-sm">Welcome back, Summoner.</p>
            </div>

            {/* RSO Button (Temporarily Hidden for Production Review) */}
        {/* <div className="mb-6">
            <a 
                href="/api/auth/riot"
                className="block w-full bg-[#d13639] hover:bg-[#b02c2f] text-white font-bold py-3.5 rounded-lg text-center transition shadow-lg shadow-red-900/20 active:scale-95 transform flex items-center justify-center gap-3"
            >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" aria-hidden="true">
                    <path d="M16.635 6.408l2.943 5.568-2.944 5.568h-5.89l-2.944-5.568 2.944-5.568h5.89m2.288-4.32H5.02L0 11.976l5.02 9.888h13.904L24 11.976l-5.077-9.888z"/>
                </svg>
                Sign in with Riot
            </a>
            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-900 px-2 text-slate-500">Or continue with email</span></div>
            </div>
        </div> */}

            <form onSubmit={handleLogin} className="space-y-5">
            {/* サモナーネーム入力欄 */}
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    Email
                </label>
                <input
                type="text"
                onChange={(e) => setLoginId(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder-slate-600"
                placeholder="name@example.com"
                />
            </div>
            {/* パスワード入力欄 */}
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                Password
                </label>
                <input
                type="password"
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder-slate-600"
                placeholder="••••••••"
                />
            </div>
            {/* ログインボタン */}
            <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold py-3.5 rounded-lg hover:from-blue-500 hover:to-cyan-500 transition shadow-lg shadow-blue-900/20 active:scale-95 transform"
                disabled={loading}
            >
                {loading ? "INITIALIZING..." : "LOGIN"}
            </button>
            </form>

            {/* アカウント誘導 */}
            <div className="mt-8 text-center space-y-4">
                <p className="text-sm text-slate-500">
                Don't have an account?{" "}
                <a href="/signup" className="text-blue-400 hover:text-blue-300 font-semibold transition hover:underline">
                    Register
                </a>
                </p>

                <p className="text-xs text-slate-600">
                    <a href="/react-password" className="hover:text-slate-400 transition">
                    Forgot Password?
                    </a>
                </p>
            </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
