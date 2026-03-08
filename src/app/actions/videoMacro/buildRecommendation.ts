import { fetchDDItemData } from "../riot";
import type { MatchV5Response, MatchV5Participant } from "../riot/types";
import type { BuildItem, BuildRecommendation } from "./types";
import { logger } from "@/lib/logger";

/** Minimal interface for Gemini-style model used in build recommendation */
type GenerativeModelLike = {
    generateContent: (prompt: string) => Promise<{ response: { text: () => string } }>;
};

export async function generateBuildRecommendation(
    matchData: MatchV5Response,
    puuid: string,
    model: GenerativeModelLike,
    language: 'ja' | 'en' | 'ko' = 'ja'
): Promise<BuildRecommendation | null> {
    try {
        // Fetch item data from Data Dragon for name resolution
        const itemData = await fetchDDItemData(language);
        const getItemName = (itemId: number): string => {
            if (!itemData?.idMap) return `Item #${itemId}`;
            const item = itemData.idMap[String(itemId)];
            return item?.name || `Item #${itemId}`;
        };

        // Find user and opponent
        const participants = matchData.info.participants;
        const me = participants.find((p) => p.puuid === puuid);
        if (!me) return null;

        // Find lane opponent (same lane, different team)
        const myTeam = me.teamId;
        const myPosition = me.teamPosition;
        const opponent = participants.find((p) =>
            p.teamId !== myTeam && p.teamPosition === myPosition
        );

        // Extract items (items 0-5 are the 6 item slots)
        const extractItems = (participant: MatchV5Participant): BuildItem[] => {
            const itemIds = [participant.item0, participant.item1, participant.item2, participant.item3, participant.item4, participant.item5];
            return itemIds
                .filter((id): id is number => id != null && id > 0)
                .map((id) => ({ id, itemName: getItemName(id) }));
        };

        const userItems = extractItems(me);
        const opponentItems = opponent ? extractItems(opponent) : [];

        // Language-specific prompt parts
        const langPrompts = {
            ja: {
                intro: 'あなたはLoLのビルドコーチです。以下の情報を基に、ビルドアドバイスを日本語で提供してください。',
                matchInfo: '【試合情報】',
                userChamp: 'ユーザーチャンピオン',
                userRole: 'ユーザーのロール',
                userBuild: 'ユーザーのビルド（アイテムID）',
                opponentChamp: '対面チャンピオン',
                opponentBuild: '対面のビルド（アイテムID）',
                result: '試合結果',
                win: '勝利',
                loss: '敗北',
                none: 'なし',
                unknown: '不明',
                analysisRequest: '【分析してほしいこと】',
                point1: '1. ユーザーのビルドの良かった点',
                point2: '2. 改善すべき点（対面や敵チーム構成を考慮）',
                point3: '3. 推奨ビルド（コアアイテム3つ程度）',
                outputFormat: '【出力形式 (JSON)】',
                analysisDesc: 'ビルドの分析とアドバイス（3-4文）',
                fallback: 'ビルドアドバイスを生成できませんでした'
            },
            en: {
                intro: 'You are a LoL build coach. Provide build advice in English based on the following information.',
                matchInfo: '【Match Information】',
                userChamp: 'User Champion',
                userRole: 'User Role',
                userBuild: 'User Build (Item IDs)',
                opponentChamp: 'Opponent Champion',
                opponentBuild: 'Opponent Build (Item IDs)',
                result: 'Match Result',
                win: 'Victory',
                loss: 'Defeat',
                none: 'None',
                unknown: 'Unknown',
                analysisRequest: '【Analysis Request】',
                point1: '1. Good points about user\'s build',
                point2: '2. Areas for improvement (considering opponent and enemy team comp)',
                point3: '3. Recommended build (3 core items)',
                outputFormat: '【Output Format (JSON)】',
                analysisDesc: 'Build analysis and advice (3-4 sentences)',
                fallback: 'Could not generate build advice'
            },
            ko: {
                intro: '당신은 LoL 빌드 코치입니다. 다음 정보를 바탕으로 한국어로 빌드 조언을 제공하세요.',
                matchInfo: '【경기 정보】',
                userChamp: '유저 챔피언',
                userRole: '유저의 역할',
                userBuild: '유저의 빌드(아이템 ID)',
                opponentChamp: '상대 챔피언',
                opponentBuild: '상대의 빌드(아이템 ID)',
                result: '경기 결과',
                win: '승리',
                loss: '패배',
                none: '없음',
                unknown: '알 수 없음',
                analysisRequest: '【분석 요청】',
                point1: '1. 유저 빌드의 좋았던 점',
                point2: '2. 개선할 점(상대와 적 팀 구성 고려)',
                point3: '3. 추천 빌드(코어 아이템 3개 정도)',
                outputFormat: '【출력 형식(JSON)】',
                analysisDesc: '빌드 분석 및 조언(3-4문장)',
                fallback: '빌드 조언을 생성할 수 없습니다'
            }
        };

        const lp = langPrompts[language];

        // Generate AI advice
        const prompt = `
${lp.intro}

${lp.matchInfo}
- ${lp.userChamp}: ${me.championName}
- ${lp.userRole}: ${myPosition}
- ${lp.userBuild}: ${userItems.map(i => i.id).join(', ') || lp.none}
- ${lp.opponentChamp}: ${opponent?.championName || lp.unknown}
- ${lp.opponentBuild}: ${opponentItems.map(i => i.id).join(', ') || lp.unknown}
- ${lp.result}: ${me.win ? lp.win : lp.loss}
- KDA: ${me.kills}/${me.deaths}/${me.assists}

${lp.analysisRequest}
${lp.point1}
${lp.point2}
${lp.point3}

${lp.outputFormat}
{
    "analysis": "${lp.analysisDesc}",
    "recommendedItemIds": [ItemID, ItemID, ItemID]
}
`;

        const result = await model.generateContent(prompt);
        const text = result.response.text()
            .replace(/^```json\s*/, "")
            .replace(/^```\s*/, "")
            .replace(/\s*```$/, "");

        const aiResponse = JSON.parse(text);

        const recommendedItems: BuildItem[] = (aiResponse.recommendedItemIds || []).map((id: number) => ({
            id,
            itemName: getItemName(id)
        }));

        return {
            userItems,
            userChampionName: me.championName,
            opponentItems,
            opponentChampionName: opponent?.championName || lp.unknown,
            recommendedItems,
            analysis: aiResponse.analysis || lp.fallback
        };
    } catch (error) {
        logger.error('[VideoMacro] Build recommendation error:', error instanceof Error ? error.message : String(error));
        return null;
    }
}
