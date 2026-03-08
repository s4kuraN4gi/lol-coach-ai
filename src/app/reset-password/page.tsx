"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import Footer from "../components/layout/Footer";
import { useTranslation } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();
  const { t } = useTranslation();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError("");

    // Block password reset for RSO synthetic accounts
    if (email.trim().toLowerCase().endsWith('@lolcoach.ai')) {
      setError(t('resetPasswordPage.rsoBlocked', 'Riotアカウント連携ユーザーはパスワードリセットできません'));
      setLoading(false);
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    setLoading(false);

    if (resetError) {
      setError(t('resetPasswordPage.resetFailed'));
      return;
    }

    setSent(true);
  };

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-200">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-end mb-4">
              <LanguageSwitcher />
            </div>
            <Link href="/" className="text-3xl font-black italic tracking-tighter text-white">
              LoL<span className="text-cyan-400">Coach</span>AI
            </Link>
            <h1 className="mt-6 text-xl font-bold text-white">
              {t('resetPasswordPage.title')}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {t('resetPasswordPage.description')}
            </p>
          </div>

          {sent ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center">
              <p className="text-emerald-400 font-medium">
                {t('resetPasswordPage.successMessage')}
              </p>
              <Link
                href="/login"
                className="inline-block mt-4 text-sm text-blue-400 hover:text-blue-300 transition"
              >
                {t('resetPasswordPage.backToLogin')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-slate-400 mb-1.5">
                  {t('resetPasswordPage.emailLabel')}
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('resetPasswordPage.emailPlaceholder')}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('resetPasswordPage.sending') : t('resetPasswordPage.sendButton')}
              </button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-slate-400 hover:text-slate-400 transition"
                >
                  {t('resetPasswordPage.backToLogin')}
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
      <Footer />
    </main>
  );
}
