"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Footer from "../Components/layout/Footer";
import { useTranslation } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";


export default function LoginPage() {
  const router = useRouter();
  const [LoginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const supabase = createClient();
  const { t } = useTranslation();
  //ログイン画面に遷移した時にサモナーネームの入力値を削除
  useEffect(() => {
    localStorage.removeItem("LoginID");
  }, []);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      alert(error.message);
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!LoginId.trim() || !password.trim()) {
      alert(t('loginPage.emptyFields'));
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: LoginId.trim(),
      password: password,
    });

    if (error) {
      alert(t('loginPage.loginFailed') + error.message);
      setLoading(false);
      return;
    }

    if (data.user && !data.user.email_confirmed_at) {
        // メール認証未完了の場合
        alert(t('loginPage.emailNotVerified'));
        await supabase.auth.signOut(); // セッションを破棄
        setLoading(false);
        return;
    }

    router.push("/dashboard");
    setLoading(false);
  };
  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden bg-[#0a0a0f]">
      <Link href="/" className="absolute top-4 left-4 z-20 text-sm text-slate-400 hover:text-slate-200 transition">
        {t('common.backToHome')}
      </Link>
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>
      {/* Background elements */}
      <div className="absolute top-[10%] right-[10%] w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[10%] w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-800 backdrop-blur-xl relative z-10 transition-all hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]">
            <div className="mb-6 text-center">
                <h1 className="text-3xl font-black text-foreground tracking-tighter mb-2">
                    <Link href="/" className="hover:opacity-80 transition">
                        LoL Coach AI
                    </Link>
                </h1>
                <p className="text-slate-400 text-sm">{t('loginPage.welcomeBack')}</p>
            </div>

            <div className="mb-6">
                <button
                    onClick={handleGoogleLogin}
                    disabled={googleLoading}
                    className="w-full bg-white hover:bg-gray-100 text-gray-800 font-bold py-3.5 rounded-lg transition shadow-lg active:scale-95 transform flex items-center justify-center gap-3"
                >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    {googleLoading ? t('loginPage.initializing') : t('loginPage.googleLogin')}
                </button>
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#0a0a0f] px-2 text-slate-500">{t('loginPage.orContinueWithEmail')}</span></div>
                </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
            {/* サモナーネーム入力欄 */}
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    {t('loginPage.emailLabel')}
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
                {t('loginPage.passwordLabel')}
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
                {loading ? t('loginPage.initializing') : t('loginPage.loginButton')}
            </button>
            </form>

            {/* アカウント誘導 */}
            <div className="mt-8 text-center space-y-4">
                <p className="text-sm text-slate-500">
                {t('loginPage.noAccount')}{" "}
                <a href="/signup" className="text-blue-400 hover:text-blue-300 font-semibold transition hover:underline">
                    {t('loginPage.register')}
                </a>
                </p>

                <p className="text-xs text-slate-600">
                    <a href="/react-password" className="hover:text-slate-400 transition">
                    {t('loginPage.forgotPassword')}
                    </a>
                </p>
            </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
