/**
 * Rank utility functions for League of Legends
 */

/**
 * Convert tier/rank to a numeric value for graphing
 * IRON IV = 0, CHALLENGER I = 2700+
 */
export function rankToNumericValue(tier: string | null, rank: string | null, lp: number | null): number {
    if (!tier) return 0;

    const tierValues: Record<string, number> = {
        'IRON': 0,
        'BRONZE': 400,
        'SILVER': 800,
        'GOLD': 1200,
        'PLATINUM': 1600,
        'EMERALD': 2000,
        'DIAMOND': 2400,
        'MASTER': 2800,
        'GRANDMASTER': 2900,
        'CHALLENGER': 3000
    };

    const divisionValues: Record<string, number> = {
        'IV': 0,
        'III': 100,
        'II': 200,
        'I': 300
    };

    const tierValue = tierValues[tier.toUpperCase()] || 0;
    const divisionValue = (rank && divisionValues[rank]) || 0;
    const lpValue = lp || 0;

    // For Master+ (no division), LP adds directly
    if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier.toUpperCase())) {
        return tierValue + lpValue;
    }

    return tierValue + divisionValue + lpValue;
}

/**
 * Format tier for display on graph Y-axis
 */
export function formatTierLabel(value: number): string {
    if (value >= 3000) return 'CH';
    if (value >= 2900) return 'GM';
    if (value >= 2800) return 'MA';
    if (value >= 2400) return 'DIA';
    if (value >= 2000) return 'EME';
    if (value >= 1600) return 'PLA';
    if (value >= 1200) return 'GOL';
    if (value >= 800) return 'SIL';
    if (value >= 400) return 'BRO';
    return 'IRO';
}

/**
 * Get tier color for styling
 */
export function getTierColor(tier: string | null): string {
    if (!tier) return '#64748b';
    const colors: Record<string, string> = {
        'IRON': '#6b7280',
        'BRONZE': '#a16207',
        'SILVER': '#94a3b8',
        'GOLD': '#eab308',
        'PLATINUM': '#22d3ee',
        'EMERALD': '#10b981',
        'DIAMOND': '#6366f1',
        'MASTER': '#a855f7',
        'GRANDMASTER': '#ef4444',
        'CHALLENGER': '#f59e0b'
    };
    return colors[tier.toUpperCase()] || '#64748b';
}
