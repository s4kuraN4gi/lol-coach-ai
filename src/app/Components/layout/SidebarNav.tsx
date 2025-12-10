"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "../../actions/auth";

export default function SidebarNav() {
    const router = useRouter();

    const handleLogout = async () => {
      await signOut();
    }

    const navItems = [
      { name: "ダッシュボード", href: "/dashboard", icon: "📊" },
      { name: "詳細戦績", href: "/dashboard/stats", icon: "📈" },
      { name: "動画コーチング", href: "/dashboard/replay", icon: "🎥" },
      { name: "サモナー解析", href: "/chat", icon: "💬" },
      { name: "アカウント", href: "/account", icon: "⚙️" },
    ];

  return (
        <aside className="w-64 bg-slate-900/50 backdrop-blur-xl border-r border-slate-800 p-6 flex flex-col justify-between sticky top-0 h-screen z-50">
            <div>
              <h2 className="text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 mb-8 px-2">
                  LOL COACH AI
              </h2>
              <nav className="flex flex-col gap-2 text-slate-400">
                  {navItems.map((item) => (
                      <Link 
                        key={item.href} 
                        href={item.href} 
                        className="hover:bg-slate-800/80 hover:text-blue-400 font-bold flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group"
                      >
                          <span className="text-xl group-hover:scale-110 transition-transform duration-200">{item.icon}</span>
                          <span className="tracking-wide text-sm">{item.name}</span>
                      </Link>
                  ))}
              </nav>
            </div>
            <div className="mt-8 border-t border-slate-800 pt-6">
              <button 
                onClick={handleLogout}
                className="w-full text-left text-red-400 hover:text-red-300 hover:bg-red-900/20 px-4 py-3 rounded-lg font-bold transition flex items-center gap-3"
              >
                <span>🚪</span>
                LOGOUT
              </button>
            </div>
        </aside>
  )
}
