import type { MatchContext, VideoMacroAnalysisResult } from "./types";
import type { MatchV5Participant } from "../riot/types";

// Role label maps for localization
export const ROLE_MAPS: Record<string, Record<string, string>> = {
    ja: { 'TOP': 'トップレーン', 'JUNGLE': 'ジャングル', 'MIDDLE': 'ミッドレーン', 'BOTTOM': 'ボットレーン(ADC)', 'UTILITY': 'ボットレーン(サポート)' },
    en: { 'TOP': 'Top Lane', 'JUNGLE': 'Jungle', 'MIDDLE': 'Mid Lane', 'BOTTOM': 'Bot Lane (ADC)', 'UTILITY': 'Bot Lane (Support)' },
    ko: { 'TOP': '탑 라인', 'JUNGLE': '정글', 'MIDDLE': '미드 라인', 'BOTTOM': '봇 라인(ADC)', 'UTILITY': '봇 라인(서포터)' },
};

export function buildMatchContext(me: MatchV5Participant, participants: MatchV5Participant[], puuid: string, lang: 'ja' | 'en' | 'ko'): MatchContext {
    const myTeamId = me.teamId;
    const allies = participants.filter((p) => p.teamId === myTeamId && p.puuid !== puuid)
        .map((p) => `${p.championName}(${p.teamPosition})`);
    const enemies = participants.filter((p) => p.teamId !== myTeamId)
        .map((p) => `${p.championName}(${p.teamPosition})`);

    const roleMap = ROLE_MAPS[lang] || ROLE_MAPS.ja;
    const myRoleJp = ROLE_MAPS.ja[me.teamPosition] || me.teamPosition;
    const myRoleLocalized = roleMap[me.teamPosition] || me.teamPosition;

    return {
        myChampion: me.championName,
        myRole: me.teamPosition,
        myRoleJp,
        myRoleLocalized,
        allies,
        enemies,
        goldDiff: 0,
    };
}

export function emptyResult(matchId: string, error: string): VideoMacroAnalysisResult {
    return {
        success: false,
        matchId,
        analyzedAt: '',
        segments: [],
        overallSummary: { mainIssue: '', homework: { title: '', description: '', howToCheck: '', relatedTimestamps: [] } },
        error,
    };
}
