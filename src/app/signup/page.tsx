'use client'

import { supabase } from "@/utils/supabaseClient";
import { useRouter } from "next/navigation";
import { useState } from "react"


export default function SignupPage() {
    const [LoginID, setLoginId] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("")
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const router = useRouter();

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
        });
        
        if (signUpError) {
            setError("登録失敗：" + signUpError.message);
            return;
        }

        // ログイン画面へ遷移
        router.push("/login");
            
    }

  return (
    <>
    <main className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white shadow-lg rounded-xl p-8 w-full max-w-md">
            <h1 className="text-2xl font-bold text-center mb-6 text-blue-600">
                アカウント登録
            </h1>
            <input
             type="text"
             placeholder="ログインID(メールアドレス)"
             value={LoginID}
             onChange={(e) => setLoginId(e.target.value)}
             className="w-full p-3 mb-3 border border-gray-300 rounded-lg"

            />
            <input
             type="password"
             placeholder="パスワード"
             value={password}
             onChange={(e) => setPassword(e.target.value)}
             className="w-full p-3 mb-3 border border-gray-300 rounded-lg "
            />
            <input
             type="password"
             placeholder="パスワード確認"
             value={passwordConfirm}
             onChange={(e) => setPasswordConfirm(e.target.value)}
             className="w-full p-3 mb-3 border border-gray-300 rounded-lg "
            />
            {error && <p className="text-red-500 text-sm mb-3">{error} </p>}
            <button
                onClick={handleSignup}
                className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition"
            >
                登録
            </button>
            <p className="text-center text-sm mt-4 text-gray-500">
                既にアカウントをお持ちですか？{" "}
                <a href="/login" className="text-blue-600 hover:underline">
                    ログインはこちら
                </a>
            </p>
        </div>
    </main>
    </>
  )
}
