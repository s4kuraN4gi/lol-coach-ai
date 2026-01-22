'use client'

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react"
import Footer from "../Components/layout/Footer";


export default function SignupPage() {
    const [LoginID, setLoginId] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("")
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [showSuccess, setShowSuccess] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleSignup = async () => {
        setError("");

        if (!LoginID.trim() || !password.trim() || !passwordConfirm.trim()){
            setError("全ての項目を入力してください")
            return;
        }
        if (password !== passwordConfirm){
            setError("パスワードが一致しません。")
            return;
        }

        const { error: signUpError } = await supabase.auth.signUp({
            email: LoginID,
            password: password,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        
        if (signUpError) {
            // "User already registered" のエラーメッセージを日本語化
            if (signUpError.message.includes("User already registered")) {
                setError("このメールアドレスは既に登録されています。ログインしてください。");
            } else {
                setError("登録失敗：" + signUpError.message);
            }
            return;
        }

        // 成功モーダルを表示
        setShowSuccess(true);
    }

    const handleCloseModal = () => {
        setShowSuccess(false);
        router.push("/login"); // モーダルを閉じたらログイン画面へ
    }

  return (
    <>
    <main className="min-h-screen flex flex-col relative overflow-hidden">
        {/* Background elements */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 -z-10"></div>
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 pointer-events-none"></div>

        <div className="flex-1 flex items-center justify-center p-4">
            <div className="glass-panel p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-800 backdrop-blur-xl relative z-10 transition-all hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                <h1 className="text-3xl font-black text-center mb-6 text-foreground tracking-tighter">
                    JOIN THE RIFT
                </h1>

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
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-900 px-2 text-slate-500">Or regiester with email</span></div>
                </div>
            </div> */}

                <div className="space-y-4">
                    <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                            Email
                        </label>
                        <input
                        type="text"
                        placeholder="name@example.com"
                        value={LoginID}
                        onChange={(e) => setLoginId(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder-slate-600"

                        />
                    </div>
                    <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                            Password
                        </label>
                        <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder-slate-600"
                        />
                    </div>
                    <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                            Confirm Password
                        </label>
                        <input
                        type="password"
                        placeholder="••••••••"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder-slate-600"
                        />
                    </div>
                </div>

                {error && <p className="text-red-400 text-sm mt-3 font-medium bg-red-900/20 p-2 rounded border border-red-900/50">{error}</p>}
                
                <button
                    onClick={handleSignup}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold py-3.5 mt-6 rounded-lg hover:from-blue-500 hover:to-cyan-500 transition shadow-lg shadow-blue-900/20 active:scale-95 transform"
                >
                    REGISTER ACCOUNT
                </button>
                {/* アカウント誘導 */}
                <div className="mt-8 text-center space-y-4">
                    <p className="text-sm text-slate-500">
                    Already have an account?{" "}
                    <a href="/login" className="text-blue-400 hover:text-blue-300 font-semibold transition hover:underline">
                        Login
                    </a>
                    </p>
                </div>
            </div>
        </div>
        <Footer />
    </main>

    {/* Success Modal */}
    {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn">
            <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-sm w-full mx-4 shadow-2xl relative animate-scaleIn">
                <div className="text-center">
                    <div className="text-5xl mb-4">📧</div>
                    <h3 className="text-2xl font-bold text-white mb-2">Check Your Email</h3>
                    <p className="text-slate-400 mb-6 leading-relaxed text-sm">
                        確認メールを送信しました。<br/>
                        メール内のリンクをクリックして登録を完了してください。<br/>
                        <span className="text-slate-500 text-xs mt-2 block">
                            ※ メールが届かない場合は、既に登録済みの可能性があります。<br/>
                            その場合はログイン画面へお進みください。
                        </span>
                    </p>
                    <button
                        onClick={handleCloseModal}
                        className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 transition"
                    >
                        ログイン画面へ
                    </button>
                </div>
            </div>
        </div>
    )}
    </>
  )
}
