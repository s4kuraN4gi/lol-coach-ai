// Rank utility functions for client-side calculations

// Tier order for comparison (higher index = higher rank)
export const TIER_ORDER = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
export const RANK_ORDER = ['IV', 'III', 'II', 'I'];

/**
 * Convert tier + rank to a numeric value for comparison
 * Higher value = higher rank
 */
export function rankToValue(tier: string, rank: string, lp: number = 0): number {
    const tierIndex = TIER_ORDER.indexOf(tier.toUpperCase());
    const rankIndex = RANK_ORDER.indexOf(rank.toUpperCase());
    if (tierIndex === -1) return 0;
    // Master+ don't have rank divisions
    if (tierIndex >= 7) {
        return (tierIndex * 400) + lp;
    }
    return (tierIndex * 400) + (rankIndex * 100) + lp;
}

/**
 * Calculate progress percentage towards goal
 */
export function calculateGoalProgress(
    currentTier: string,
    currentRank: string,
    currentLP: number,
    targetTier: string,
    targetRank: string
): { progress: number; remaining: number; achieved: boolean } {
    const currentValue = rankToValue(currentTier, currentRank, currentLP);
    const targetValue = rankToValue(targetTier, targetRank, 0);

    // If already achieved or exceeded
    if (currentValue >= targetValue) {
        return { progress: 100, remaining: 0, achieved: true };
    }

    // Calculate starting point (one full division below current)
    const startValue = Math.max(0, currentValue - 100);
    const totalDistance = targetValue - startValue;
    const currentDistance = currentValue - startValue;

    const progress = Math.min(100, Math.max(0, Math.round((currentDistance / totalDistance) * 100)));
    const remaining = targetValue - currentValue;

    return { progress, remaining, achieved: false };
}
