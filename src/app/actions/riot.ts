/**
 * Barrel file — re-exports from riot/ submodules.
 * Existing import paths (e.g. "@/app/actions/riot") remain valid.
 */

// Types
export type {
    RiotAccount,
    SummonerDTO,
    LeagueEntryDTO,
    ChampionAttributes,
    MacroKnowledge,
    MacroAdviceContext,
    TruthEvent,
    FrameStats,
    ParticipantRole,
    ParticipantRoleMap,
} from "./riot/types";

// Account & verification
export { fetchRiotAccount } from "./riot/account";

// Summoner
export { fetchSummonerByPuuid } from "./riot/summoner";

// League / Ranked
export { fetchRankByPuuid, fetchRank } from "./riot/league";

// Match data & timeline
export {
    fetchMatchIds,
    fetchMatchDetail,
    fetchMatchTimeline,
    buildParticipantRoleMap,
    extractMatchEvents,
    extractFrameStats,
} from "./riot/match";

// DDragon & CommunityDragon
export {
    fetchLatestVersion,
    fetchRunesReforged,
    fetchAllChampions,
    fetchDDItemData,
    fetchChampionDetail,
    fetchChampionBinData,
} from "./riot/ddragon";

// Macro knowledge & advice
export {
    getChampionAttributes,
    getMacroKnowledge,
    getRelevantMacroAdvice,
    getEnhancedMacroAdvice,
} from "./riot/macro";
