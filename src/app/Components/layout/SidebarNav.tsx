import { supabase } from "@/utils/supabaseClient";
import { useRouter } from "next/navigation";

export default function SidebarNav() {
    const router = useRouter();

    const handleLogout = async () => {
      await supabase.auth.signOut();
    router.push("/login");
    }
  return (
        <aside className="w-64 bg-white shadow-md p-6 border-r border-gray-200 flex flex-col justify-between">
            <div>
              <h2 className="text-2xl font-bold text-blue-600 mb-6">LOL Coach AI</h2>
              <nav className="flex flex-col gap-4 text-gray-700">
                  <a href="/dashboard" className="hover:text-blue-500 font-medium">ダッシュボード</a>
                  <a href="/video" className="hover:text-blue-500 font-medium">動画解析</a>
                  <a href="/chat" className="hover:text-blue-500 font-medium">サモナー解析</a>
                  <a href="/account" className="hover:text-blue-500 font-medium">アカウント管理</a>
              </nav>
            </div>
            <div className="mt-8 border-t border-gray-200 pt-4">
              <button 
                onClick={handleLogout}
                className="w-full text-left text-red-500 font-semibold hover:text-red-700 transition"
              >
                ログアウト
              </button>
            </div>
        </aside>
  )
}
