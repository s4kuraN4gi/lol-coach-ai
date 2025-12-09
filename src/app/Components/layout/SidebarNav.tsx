import { supabase } from "@/utils/supabaseClient";
import { useRouter } from "next/navigation";

export default function SidebarNav() {
    const router = useRouter();

    const handleLogout = async () => {
      await supabase.auth.signOut();
    router.push("/login");
    }

    const navItems = [
      { name: "ダッシュボード", href: "/dashboard", icon: "📊" },
      { name: "詳細戦績", href: "/dashboard/stats", icon: "📈" },
      { name: "動画コーチング", href: "/dashboard/replay", icon: "🎥" },
      { name: "サモナー解析", href: "/chat", icon: "💬" },
      { name: "アカウント", href: "/account", icon: "⚙️" },
    ];

  return (
        <aside className="w-64 bg-white shadow-md p-6 border-r border-gray-200 flex flex-col justify-between">
            <div>
              <h2 className="text-2xl font-bold text-blue-600 mb-6">LOL Coach AI</h2>
              <nav className="flex flex-col gap-4 text-gray-700">
                  {navItems.map((item) => (
                      <a key={item.href} href={item.href} className="hover:text-blue-500 font-medium flex items-center gap-2">
                          <span className="text-lg">{item.icon}</span>
                          {item.name}
                      </a>
                  ))}
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
