"use client";

import { createContext, useContext, useCallback, useMemo } from "react";
import useSWR from "swr";
import { getActiveSummoner, type SummonerAccount } from "@/app/actions/profile";
import { useAuth } from "./AuthProvider";
import { logger } from "@/lib/logger";

type SummonerContextType = {
  activeSummoner: SummonerAccount | null;
  loading: boolean;
  refreshSummoner: () => Promise<void>;
};

const SummonerContext = createContext<SummonerContextType | undefined>(
  undefined
);

async function fetchSummoner(): Promise<SummonerAccount | null> {
  return getActiveSummoner();
}

export function SummonerProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading, mutate } = useSWR(
    user ? "active-summoner" : null, // null key → don't fetch when no user
    fetchSummoner,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      onError: (err) => {
        logger.error("Failed to fetch active summoner", err);
      },
    }
  );

  const refreshSummoner = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const contextValue = useMemo<SummonerContextType>(() => ({
    activeSummoner: data ?? null,
    loading: authLoading || isLoading,
    refreshSummoner,
  }), [data, authLoading, isLoading, refreshSummoner]);

  return (
    <SummonerContext.Provider value={contextValue}>
      {children}
    </SummonerContext.Provider>
  );
}

export function useSummoner() {
  const ctx = useContext(SummonerContext);
  if (!ctx) throw new Error("useSummoner must be used inside SummonerProvider");
  return ctx;
}
