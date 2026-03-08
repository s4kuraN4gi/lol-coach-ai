'use client'

import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react"
import Footer from "../components/layout/Footer";
import { useTranslation } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";


export default function SignupPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("")
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [showSuccess, setShowSuccess] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const successModalRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();
    const { t } = useTranslation();

    // Password strength: 0=none, 1=weak, 2=medium, 3=strong
    const passwordStrength = useMemo(() => {
        if (!password) return 0;
        let score = 0;
        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        return score;
    }, [password]);

    // Store referral code from URL
    useEffect(() => {
        const ref = searchParams.get('ref');
        if (ref) {
            localStorage.setItem('referral_code', JSON.stringify({ code: ref, expires: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
        }
    }, [searchParams]);

    const handleGoogleSignup = async () => {
        setGoogleLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        if (error) {
            setError(t('signupPage.googleAuthFailed'));
            setGoogleLoading(false);
        }
    };

    const handleSignup = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setError("");

        if (!email.trim() || !password.trim() || !passwordConfirm.trim()){
            setError(t('signupPage.allFieldsRequired'))
            return;
        }
        if (password.length < 8) {
            setError(t('signupPage.passwordTooShort', 'パスワードは8文字以上で入力してください'));
            return;
        }
        if (password !== passwordConfirm){
            setError(t('signupPage.passwordMismatch'))
            return;
        }

        // Block registration with synthetic RSO email domain
        if (email.trim().toLowerCase().endsWith('@lolcoach.ai')) {
            setError(t('signupPage.reservedDomain', 'このメールドメインは使用できません'));
            return;
        }

        const { error: signUpError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        
        if (signUpError) {
            const msg = signUpError.message;
            if (msg.includes("User already registered")) {
                setError(t('signupPage.alreadyRegistered'));
            } else if (msg.includes("Invalid email")) {
                setError(t('signupPage.errors.invalidEmail'));
            } else if (msg.includes("Password should be at least")) {
                setError(t('signupPage.errors.weakPassword'));
            } else if (msg.includes("rate limit") || msg.includes("too many requests")) {
                setError(t('signupPage.errors.tooManyRequests'));
            } else {
                setError(t('signupPage.errors.generic'));
            }
            return;
        }

        // 成功モーダルを表示
        setShowSuccess(true);
    }

    // Focus trap for success modal
    useEffect(() => {
        if (!showSuccess) return;
        const dialog = successModalRef.current;
        if (!dialog) return;
        const focusable = dialog.querySelectorAll<HTMLElement>('button, [href], input');
        focusable[0]?.focus();
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { handleCloseModal(); return; }
            if (e.key !== 'Tab') return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [showSuccess]);

    const handleCloseModal = () => {
        setShowSuccess(false);
        router.push("/login"); // モーダルを閉じたらログイン画面へ
    }

  return (
    <>
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
            <div className="glass-panel p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-800 backdrop-blur-xl relative z-10 transition-all hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                <h1 className="text-3xl font-black text-center mb-6 text-foreground tracking-tighter">
                    <Link href="/" className="hover:opacity-80 transition">
                        {t('signupPage.title')}
                    </Link>
                </h1>

                <div className="mb-6">
                    <button
                        onClick={handleGoogleSignup}
                        disabled={googleLoading}
                        className="w-full bg-white hover:bg-gray-100 text-gray-800 font-bold py-3.5 rounded-lg transition shadow-lg active:scale-95 transform flex items-center justify-center gap-3"
                    >
                        <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        {googleLoading ? t('signupPage.loading', '...') : t('signupPage.googleSignup')}
                    </button>
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#0a0a0f] px-2 text-slate-400">{t('signupPage.orRegisterWithEmail')}</span></div>
                    </div>
                </div>

                <form onSubmit={handleSignup} className="space-y-4">
                    <div>
                    <label htmlFor="signup-email" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                            {t('signupPage.emailLabel')}
                        </label>
                        <input
                        id="signup-email"
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder-slate-600"
                        />
                    </div>
                    <div>
                    <label htmlFor="signup-password" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                            {t('signupPage.passwordLabel')}
                        </label>
                        <input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder-slate-600"
                        />
                        {password && (
                            <div className="mt-2">
                                <div className="flex gap-1">
                                    <div className={`h-1 flex-1 rounded-full transition-colors ${passwordStrength >= 1 ? (passwordStrength === 1 ? 'bg-red-500' : passwordStrength === 2 ? 'bg-yellow-500' : 'bg-emerald-500') : 'bg-slate-700'}`} />
                                    <div className={`h-1 flex-1 rounded-full transition-colors ${passwordStrength >= 2 ? (passwordStrength === 2 ? 'bg-yellow-500' : 'bg-emerald-500') : 'bg-slate-700'}`} />
                                    <div className={`h-1 flex-1 rounded-full transition-colors ${passwordStrength >= 3 ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                                </div>
                                <p className={`text-xs mt-1 ${passwordStrength <= 1 ? 'text-red-400' : passwordStrength === 2 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                                    {passwordStrength <= 1 ? t('signupPage.passwordWeak', 'Weak — add uppercase & numbers') : passwordStrength === 2 ? t('signupPage.passwordMedium', 'Medium — add uppercase or numbers') : t('signupPage.passwordStrong', 'Strong')}
                                </p>
                            </div>
                        )}
                    </div>
                    <div>
                    <label htmlFor="signup-password-confirm" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                            {t('signupPage.confirmPasswordLabel')}
                        </label>
                        <input
                        id="signup-password-confirm"
                        type="password"
                        placeholder="••••••••"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder-slate-600"
                        />
                    </div>

                    {error && <p className="text-red-400 text-sm mt-3 font-medium bg-red-900/20 p-2 rounded border border-red-900/50">{error}</p>}

                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold py-3.5 mt-6 rounded-lg hover:from-blue-500 hover:to-cyan-500 transition shadow-lg shadow-blue-900/20 active:scale-95 transform"
                    >
                        {t('signupPage.registerButton')}
                    </button>
                    <p className="text-xs text-slate-400 mt-3 text-center leading-relaxed">
                        {(() => {
                            const text = t('signupPage.termsAgreement', 'By registering, you agree to our {terms} and {privacy}.');
                            const parts = text.split(/\{terms\}|\{privacy\}/);
                            return <>
                                {parts[0]}
                                <Link href="/terms" className="text-blue-400 hover:underline">{t('signupPage.termsOfService', 'Terms of Service')}</Link>
                                {parts[1]}
                                <Link href="/privacy" className="text-blue-400 hover:underline">{t('signupPage.privacyPolicy', 'Privacy Policy')}</Link>
                                {parts[2]}
                            </>;
                        })()}
                    </p>
                </form>
                {/* アカウント誘導 */}
                <div className="mt-8 text-center space-y-4">
                    <p className="text-sm text-slate-400">
                    {t('signupPage.alreadyHaveAccount')}{" "}
                    <Link href="/login" className="text-blue-400 hover:text-blue-300 font-semibold transition hover:underline">
                        {t('signupPage.login')}
                    </Link>
                    </p>
                </div>
            </div>
        </div>
        <Footer />
    </main>

    {/* Success Modal */}
    {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={handleCloseModal}>
            <div ref={successModalRef} role="dialog" aria-modal="true" aria-labelledby="signup-success-title" className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-sm w-full mx-4 shadow-2xl relative animate-scaleIn" onClick={(e) => e.stopPropagation()}>
                <div className="text-center">
                    <div className="text-5xl mb-4" aria-hidden="true">📧</div>
                    <h3 id="signup-success-title" className="text-2xl font-bold text-white mb-2">{t('signupPage.emailSent')}</h3>
                    <p className="text-slate-400 mb-6 leading-relaxed text-sm">
                        {t('signupPage.checkEmail')}<br/>
                        <span className="text-slate-400 text-xs mt-2 block">
                            {t('signupPage.alreadyRegisteredNote')}
                        </span>
                    </p>
                    <button
                        onClick={handleCloseModal}
                        className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 transition"
                    >
                        {t('signupPage.goToLogin')}
                    </button>
                </div>
            </div>
        </div>
    )}
    </>
  )
}
