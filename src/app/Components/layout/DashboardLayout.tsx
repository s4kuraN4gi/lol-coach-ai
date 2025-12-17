'use client'


import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import SidebarNav from "./SidebarNav";
import Footer from "./Footer";
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
    <div className="min-h-screen flex bg-slate-950 text-slate-200 selection:bg-blue-500/30 selection:text-blue-200">
      {/* 左ナビゲーション */}
      <SidebarNav />
        <main className="flex-1 p-8 overflow-y-auto custom-scrollbar relative">
             {/* Global Background Glow */}
             <div className="fixed top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-950 to-slate-950 pointer-events-none -z-10"></div>
             {children}
             <div className="mt-12">
                <Footer />
             </div>
        </main>
    </div>
  )
}


