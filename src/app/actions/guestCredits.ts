"use server";

import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

// Create Supabase client with service role for server-side operations
function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

// In-memory fallback for when migration is not applied
// This allows guests to use the feature without DB setup
// Note: This resets on server restart, but provides a working experience
const inMemoryCredits: Map<string, { credits: number; lastUsedAt: Date | null }> = new Map();

// Check if the guest_credits table exists
let tableChecked = false;
let tableExists = false;

async function checkGuestCreditsTable(): Promise<boolean> {
    if (tableChecked) return tableExists;

    try {
        const supabase = getSupabaseAdmin();
        // Try to query the table - if it doesn't exist, this will throw
        const { error } = await supabase
            .from("guest_credits")
            .select("id")
            .limit(1);

        tableExists = !error || !error.message.includes("does not exist");
        tableChecked = true;
        return tableExists;
    } catch {
        tableChecked = true;
        tableExists = false;
        return false;
    }
}

// Get client IP from headers
async function getClientIP(): Promise<string> {
    const headersList = await headers();

    // Try various headers in order of preference
    const forwarded = headersList.get("x-forwarded-for");
    if (forwarded) {
        // x-forwarded-for can contain multiple IPs, take the first one
        return forwarded.split(",")[0].trim();
    }

    const realIP = headersList.get("x-real-ip");
    if (realIP) {
        return realIP;
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

/**
 * Get guest credit status based on IP address
 * Uses in-memory fallback if DB table doesn't exist
 */
export async function getGuestCreditStatus(): Promise<GuestCreditStatus> {
    const ip = await getClientIP();

    // Check if table exists, use in-memory fallback if not
    const hasTable = await checkGuestCreditsTable();

    if (!hasTable) {
        // Use in-memory fallback
        const memoryRecord = inMemoryCredits.get(ip);
        if (!memoryRecord) {
            // New guest - give 3 credits
            inMemoryCredits.set(ip, { credits: 3, lastUsedAt: null });
            return {
                credits: 3,
                canUse: true,
                nextCreditAt: null,
                isGuest: true,
            };
        }

        // Replenish credits based on time (1 per 3 days)
        if (memoryRecord.lastUsedAt) {
            const daysSinceUse = (Date.now() - memoryRecord.lastUsedAt.getTime()) / (1000 * 60 * 60 * 24);
            const creditsToAdd = Math.floor(daysSinceUse / 3);
            if (creditsToAdd > 0) {
                memoryRecord.credits = Math.min(3, memoryRecord.credits + creditsToAdd);
            }
        }

        return {
            credits: memoryRecord.credits,
            canUse: memoryRecord.credits > 0,
            nextCreditAt: memoryRecord.credits < 3 && memoryRecord.lastUsedAt
                ? new Date(memoryRecord.lastUsedAt.getTime() + 3 * 24 * 60 * 60 * 1000)
                : null,
            isGuest: true,
        };
    }

    // Use database
    const supabase = getSupabaseAdmin();

    try {
        // Call the replenish function which handles both creation and replenishment
        const { data, error } = await supabase
            .rpc("replenish_guest_credits", { p_ip_address: ip });

        if (error) {
            console.error("Error getting guest credits:", error);
            // Return default for new guests
            return {
                credits: 3,
                canUse: true,
                nextCreditAt: null,
                isGuest: true,
            };
        }

        const result = data?.[0] || { current_credits: 3, can_use: true };

        // Calculate next credit time if not at max
        let nextCreditAt: Date | null = null;
        if (result.current_credits < 3) {
            // Get last_used_at to calculate next credit
            const { data: record } = await supabase
                .from("guest_credits")
                .select("last_used_at")
                .eq("ip_address", ip)
                .single();

            if (record?.last_used_at) {
                const lastUsed = new Date(record.last_used_at);
                // Next credit comes 3 days after last use (per credit)
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
        return {
            credits: 3,
            canUse: true,
            nextCreditAt: null,
            isGuest: true,
        };
    }
}

/**
 * Use one guest credit for analysis
 * Returns true if credit was successfully used
 * Uses in-memory fallback if DB table doesn't exist
 */
export async function useGuestCredit(): Promise<{ success: boolean; remainingCredits: number }> {
    const ip = await getClientIP();

    // Check if table exists, use in-memory fallback if not
    const hasTable = await checkGuestCreditsTable();

    if (!hasTable) {
        // Use in-memory fallback
        let memoryRecord = inMemoryCredits.get(ip);
        if (!memoryRecord) {
            // New guest - give 3 credits
            memoryRecord = { credits: 3, lastUsedAt: null };
            inMemoryCredits.set(ip, memoryRecord);
        }

        // Replenish credits first
        if (memoryRecord.lastUsedAt) {
            const daysSinceUse = (Date.now() - memoryRecord.lastUsedAt.getTime()) / (1000 * 60 * 60 * 24);
            const creditsToAdd = Math.floor(daysSinceUse / 3);
            if (creditsToAdd > 0) {
                memoryRecord.credits = Math.min(3, memoryRecord.credits + creditsToAdd);
            }
        }

        if (memoryRecord.credits <= 0) {
            return { success: false, remainingCredits: 0 };
        }

        // Use a credit
        memoryRecord.credits -= 1;
        memoryRecord.lastUsedAt = new Date();

        return {
            success: true,
            remainingCredits: memoryRecord.credits,
        };
    }

    // Use database
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
 * This is determined by the absence of auth session
 */
export async function isGuestUser(): Promise<boolean> {
    const { createClient: createServerClient } = await import("@/utils/supabase/server");
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return !user;
}
