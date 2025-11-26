"use client";

import { createContext, useContext, useEffect, useState } from "react";

type SummonerAccount = {
  id: string;
  name: string;
};

type SummonerContextType = {
  selectedSummoner: SummonerAccount | null;
  setSelectedSummoner: (acc: SummonerAccount | null) => void;
    loading: boolean;
};

const SummonerContext = createContext<SummonerContextType | undefined>(
  undefined
);

export function SummonerProvider({ children }: { children: React.ReactNode }) {
  const [selectedSummoner, setSelectedSummoner] =
    useState<SummonerAccount | null>(null);
    const [loading, setLoading] = useState(true);
  useEffect(() => {
    const saved = localStorage.getItem("selectedSummoner");
    if (saved) {
        setSelectedSummoner(JSON.parse(saved));
    }
    setLoading(false);
  }, []);

  return (
    <SummonerContext.Provider value={{ selectedSummoner, setSelectedSummoner, loading }}>
      {children}
    </SummonerContext.Provider>
  );
}

export function useSummoner() {
  const ctx = useContext(SummonerContext);
  if (!ctx) throw new Error("useSummoner must be used inside SummonerProvider");
  return ctx;
}
