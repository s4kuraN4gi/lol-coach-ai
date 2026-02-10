'use client'


import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import SidebarNav from "./SidebarNav";
import Footer from "./Footer";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useSummoner } from "../../Providers/SummonerProvider";
import { useAuth } from "@/app/Providers/AuthProvider";

type DashboardLayoutProps = {
  children: React.ReactNode
}

export default function DashboardLayout({children}: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  const { user, loading: authLoading } = useAuth();
  const { activeSummoner, loading: summonerLoading } = useSummoner();

  useEffect(() => {
    if(authLoading) return;

    if(!user) {
      router.push("/login");
      return;
    }

    // Onboarding Check
    // If not loading and no active summoner, redirect to onboarding
    if (!summonerLoading && !activeSummoner) {
        router.push("/onboarding");
    }
  }, [user, router, authLoading, activeSummoner, summonerLoading]);

  if(authLoading || !user) {
    return <div className="text-center mt-10">読み込み中...</div>
  }

  return (
    <div className="min-h-screen flex bg-[#0a0a0f] text-slate-200 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* 左ナビゲーション */}
      <SidebarNav />
        <main className="flex-1 flex flex-col overflow-y-auto custom-scrollbar relative">
             {/* Global Background Glow */}
             <div className="fixed top-[5%] right-[5%] w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[150px] pointer-events-none -z-10" />
             <div className="fixed bottom-[10%] left-[30%] w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />
             
             {/* Top Header with Language Switcher */}
             <header className="flex justify-end items-center px-8 py-4 border-b border-slate-800/50">
                 <LanguageSwitcher />
             </header>
             
             <div className="flex-1 p-8">
                 {children}
             </div>
             <div className="mt-12 px-8">
                <Footer />
             </div>
        </main>
    </div>
  )
}


