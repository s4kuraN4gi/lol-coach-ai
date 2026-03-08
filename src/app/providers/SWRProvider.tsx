"use client";

import { SWRConfig } from "swr";
import { ReactNode } from "react";

type Props = {
    children: ReactNode;
};

export default function SWRProvider({ children }: Props) {
    return (
        <SWRConfig
            value={{
                // Stale-While-Revalidate: Show cached data immediately
                revalidateOnFocus: false, // Don't refetch on window focus
                revalidateOnReconnect: true, // Refetch when connection restored
                dedupingInterval: 5000, // Dedupe requests within 5 seconds
                errorRetryCount: 3, // Retry failed requests 3 times
                refreshInterval: 0, // Don't auto-refresh

                // Use SWR's default in-memory cache (no custom provider needed)
                // This ensures cache persists across navigations within the same session
            }}
        >
            {children}
        </SWRConfig>
    );
}
