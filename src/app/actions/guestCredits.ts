"use server";

import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

// Create Supabase client with service role for server-side operations
function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// Get client IP from headers (CF-Connecting-IP preferred for Cloudflare deployments)
async function getClientIP(): Promise<string> {
    const headersList = await headers();

    // 1. Cloudflare's trusted header (cannot be spoofed behind CF)
    const cfIP = headersList.get("cf-connecting-ip");
    if (cfIP) {
        return cfIP;
    }

    // 2. x-real-ip (set by reverse proxies like nginx)
    const realIP = headersList.get("x-real-ip");
    if (realIP) {
        return realIP;
    }

    // 3. x-forwarded-for (take first entry only)
    const forwarded = headersList.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }

    // Fallback for local development
    return "127.0.0.1";
}

export type GuestCreditStatus = {
    credits: number;
    canUse: boolean;
    nextCreditAt: Date | null;
    isGuest: true;
};

const FAIL_CLOSED: GuestCreditStatus = {
    credits: 0,
    canUse: false,
    nextCreditAt: null,
    isGuest: true,
};

/**
 * Get guest credit status based on IP address.
 * Fail-Closed: errors result in canUse: false.
 */
export async function getGuestCreditStatus(): Promise<GuestCreditStatus> {
    const ip = await getClientIP();
    const supabase = getSupabaseAdmin();

    try {
        const { data, error } = await supabase
            .rpc("replenish_guest_credits", { p_ip_address: ip });

        if (error) {
            console.error("Error getting guest credits:", error);
            return FAIL_CLOSED;
        }

        const result = data?.[0] || { current_credits: 0, can_use: false };

        // Calculate next credit time if not at max
        let nextCreditAt: Date | null = null;
        if (result.current_credits < 3) {
            const { data: record } = await supabase
                .from("guest_credits")
                .select("last_used_at")
                .eq("ip_address", ip)
                .single();

            if (record?.last_used_at) {
                const lastUsed = new Date(record.last_used_at);
                const daysUntilNext = 3 - ((Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24)) % 3;
                nextCreditAt = new Date(Date.now() + daysUntilNext * 24 * 60 * 60 * 1000);
            }
        }

        return {
            credits: result.current_credits,
            canUse: result.can_use,
            nextCreditAt,
            isGuest: true,
        };
    } catch (err) {
        console.error("Error in getGuestCreditStatus:", err);
        return FAIL_CLOSED;
    }
}

/**
 * Use one guest credit for analysis.
 * Fail-Closed: errors result in success: false.
 */
export async function useGuestCredit(): Promise<{ success: boolean; remainingCredits: number }> {
    const ip = await getClientIP();
    const supabase = getSupabaseAdmin();

    try {
        const { data, error } = await supabase
            .rpc("use_guest_credit", { p_ip_address: ip });

        if (error) {
            console.error("Error using guest credit:", error);
            return { success: false, remainingCredits: 0 };
        }

        // Get updated credit count
        const status = await getGuestCreditStatus();

        return {
            success: data === true,
            remainingCredits: status.credits,
        };
    } catch (err) {
        console.error("Error in useGuestCredit:", err);
        return { success: false, remainingCredits: 0 };
    }
}

/**
 * Check if the current request is from a guest (not logged in)
 */
export async function isGuestUser(): Promise<boolean> {
    const { createClient: createServerClient } = await import("@/utils/supabase/server");
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return !user;
}
