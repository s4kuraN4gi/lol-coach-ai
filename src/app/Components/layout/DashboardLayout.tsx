'use client'


import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import SidebarNav from "./SidebarNav";
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
    }
  }, [user,router, authLoading]);

  useEffect(() => {
    if(summonerLoading || authLoading) return; // Wait for both
    if(pathname === "/account" || pathname === "/login" || pathname === "/header" || pathname === "/signup") return; // Added /signup etc specific ignores if needed, but pathname is simple usually.

    if(!activeSummoner) {
      router.push("/account");
    }
  }, [activeSummoner, router, pathname, summonerLoading, authLoading]);

  if(authLoading || !user) {
    return <div className="text-center mt-10">読み込み中...</div>
  }

  return (
    <div className="min-h-screen flex bg-gray-50 text-gray-900">
      {/* 左ナビゲーション */}
      <SidebarNav />
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  )
}


