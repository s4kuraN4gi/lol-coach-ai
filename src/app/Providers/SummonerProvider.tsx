"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getActiveSummoner, type SummonerAccount } from "@/app/actions/profile";
import { useAuth } from "./AuthProvider";

type SummonerContextType = {
  activeSummoner: SummonerAccount | null;
  loading: boolean;
  refreshSummoner: () => Promise<void>;
};

const SummonerContext = createContext<SummonerContextType | undefined>(
  undefined
);

export function SummonerProvider({ children }: { children: React.ReactNode }) {
  const [activeSummoner, setActiveSummoner] = useState<SummonerAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  const fetchActive = useCallback(async () => {
    // Authがまだロード中なら何もしない（loadingはtrueのまま待機）
    if(authLoading) return;

    if (!user) {
        setActiveSummoner(null);
        setLoading(false);
        return;
    }
    
    // データ取得開始時にローディングにする
    setLoading(true);
    try {
        const data = await getActiveSummoner();
        setActiveSummoner(data);
    } catch (e) {
        console.error("Failed to fetch active summoner", e);
    } finally {
        setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  return (
    <SummonerContext.Provider value={{ 
        activeSummoner, 
        loading,
        refreshSummoner: fetchActive 
    }}>
      {children}
    </SummonerContext.Provider>
  );
}

export function useSummoner() {
  const ctx = useContext(SummonerContext);
  if (!ctx) throw new Error("useSummoner must be used inside SummonerProvider");
  return ctx;
}
