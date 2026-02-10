// Fixed segments for guest analysis (no PUUID needed)
// These are key moments in typical LoL games

export const GUEST_FIXED_SEGMENTS = [
    {
        segmentId: 0,
        type: 'EARLY_GAME' as const,
        targetTimestamp: 180000,      // 3:00 - Early laning phase
        targetTimestampStr: "3:00",
        analysisStartTime: 150000,    // 2:30
        analysisEndTime: 180000,
        eventDescription: "Early laning phase - First wave management"
    },
    {
        segmentId: 1,
        type: 'OBJECTIVE' as const,
        targetTimestamp: 480000,      // 8:00 - First objective window
        targetTimestampStr: "8:00",
        analysisStartTime: 450000,    // 7:30
        analysisEndTime: 480000,
        eventDescription: "First objective window - Dragon/Rift Herald timing"
    },
    {
        segmentId: 2,
        type: 'MID_GAME' as const,
        targetTimestamp: 900000,      // 15:00 - Mid game transition
        targetTimestampStr: "15:00",
        analysisStartTime: 870000,    // 14:30
        analysisEndTime: 900000,
        eventDescription: "Mid game transition - Tower plates falling"
    }
] as const;

export type GuestSegment = typeof GUEST_FIXED_SEGMENTS[number];
