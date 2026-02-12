"use client";

import { useAuth } from "@/app/Providers/AuthProvider";

/**
 * Returns the appropriate "back" URL based on auth state.
 * Logged-in users go to /dashboard, guests go to /.
 */
export function useBackUrl(): string {
    const { user, loading } = useAuth();
    if (loading) return "/";
    return user ? "/dashboard" : "/";
}
