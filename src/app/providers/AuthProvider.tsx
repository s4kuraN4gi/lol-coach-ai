/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { createClient } from "@/utils/supabase/client";
import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { processReferralSignup } from "@/app/actions/referral";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const stableSetUser = useCallback((u: User | null) => setUser(u), []);
  const referralProcessed = useRef(false);

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user ?? null);
      setLoading(false);
    };
    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  // Process referral code after login
  useEffect(() => {
    if (!user || referralProcessed.current) return;
    referralProcessed.current = true;

    const raw = localStorage.getItem('referral_code');
    if (!raw) return;
    localStorage.removeItem('referral_code');

    let refCode: string | null = null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.code && parsed.expires > Date.now()) {
        refCode = parsed.code;
      }
    } catch {
      // Legacy plain string format
      refCode = raw;
    }
    if (!refCode) return;
    processReferralSignup(refCode).catch(() => {});
  }, [user]);

  const contextValue = useMemo<AuthContextType>(() => ({
    user, loading, setUser: stableSetUser,
  }), [user, loading, stableSetUser]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}