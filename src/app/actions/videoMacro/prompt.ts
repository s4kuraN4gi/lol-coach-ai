import macroKnowledge from "@/data/macro_knowledge.json";
import type { VideoMacroSegment, MatchContext, SegmentAnalysis } from "./types";

export function generateVideoMacroPrompt(
    segment: VideoMacroSegment,
    matchContext: MatchContext,
    language: 'ja' | 'en' | 'ko' = 'ja'
): string {
    // Get relevant macro knowledge
    const gamePhase = segment.targetTimestamp < 14 * 60 * 1000 ? 'early_game' :
                      segment.targetTimestamp < 25 * 60 * 1000 ? 'mid_game' : 'late_game';

    const phaseKnowledge = macroKnowledge.time_phase_priorities[gamePhase as keyof typeof macroKnowledge.time_phase_priorities];
    const gameStateKey = matchContext.goldDiff <= -5000 ? 'losing_hard' :
                         matchContext.goldDiff <= -3000 ? 'losing_slightly' :
                         matchContext.goldDiff >= 5000 ? 'winning_hard' :
                         matchContext.goldDiff >= 3000 ? 'winning_slightly' : 'even';
    const stateKnowledge = macroKnowledge.game_state_strategy[gameStateKey as keyof typeof macroKnowledge.game_state_strategy];

    const roleLabel = matchContext.myRoleLocalized;

    // Full prompt templates for each language
    const prompts = {
        ja: `あなたはLeague of Legendsの「マクロ戦術（マップ全体の動き・ローテーション・オブジェクトコントロール）」に特化した専門コーチです。

**全ての分析テキストを日本語で出力してください。**

【重要：分析の焦点】
- **マクロのみ**: ミクロ（操作、スキル精度）には一切言及しないでください
- **ミニマップを見る**: 全チャンピオンの位置、ウェーブの位置を確認
- **「勝ちパターン」を提示**: この状況で何をすべきだったかを具体的に

【ミニマップの読み方 - 非常に重要】
ミニマップは画面右下に表示されています。レーンの位置は以下の通りです：
- **トップレーン**: ミニマップの**左上〜上部**のライン（マップの北西側）
- **ミッドレーン**: ミニマップの**中央を斜めに**走るライン（左下から右上への対角線）
- **ボットレーン**: ミニマップの**右下〜下部**のライン（マップの南東側）

【プレイヤー情報】
- ユーザーのチャンピオン: ${matchContext.myChampion}
- ユーザーの担当レーン: **${roleLabel}**
- 味方チーム: ${matchContext.allies.join(', ')}
- 敵チーム: ${matchContext.enemies.join(', ')}
- ゴールド差: ${matchContext.goldDiff}G

【分析対象のシーン】
- タイプ: ${segment.type}
- タイムスタンプ: ${segment.targetTimestampStr}
- 何が起きたか: ${segment.eventDescription}

【マクロの基本概念（これらを使って説明してください）】
- Push and Rotate: ウェーブを敵タワーに押してからローテーション
- Cross-mapping: 敵がいる場所の反対側でリソースを取る
- Slow Push: スロープッシュ→クラッシュ→中央受けの繰り返し
- Split Push: サイドレーンでプレッシャーをかける
- Objective Setup: オブジェクトスポーン前にウェーブを押してポジショニング

【出力形式 (JSON)】
{
    "observation": {
        "userPosition": "${matchContext.myChampion}が${roleLabel}でファーム中",
        "allyPositions": "味方の位置を記載",
        "enemyPositions": "見える敵の位置（見えない場合は位置不明）",
        "waveState": "各レーンのウェーブ状況",
        "objectiveState": "オブジェクトの状況"
    },
    "winningPattern": {
        "title": "勝ちパターンのタイトル",
        "steps": ["ステップ1", "ステップ2", "ステップ3"],
        "macroConceptUsed": "使用したマクロ概念名（英語）"
    },
    "gap": {
        "description": "実際との差",
        "criticalMoment": "判断を変えるべきだったタイミング",
        "whatShouldHaveDone": "具体的にすべきだったこと"
    }
}`,

        en: `You are an expert League of Legends macro strategy coach specializing in map-wide movement, rotations, and objective control.

**Output ALL analysis text in English.**

【IMPORTANT: Analysis Focus】
- **MACRO ONLY**: Do NOT mention micro (mechanics, skill accuracy)
- **Check Minimap**: Verify all champion positions and wave positions
- **Show "Winning Pattern"**: Be specific about what should have been done

【How to Read the Minimap - Very Important】
The minimap is displayed in the bottom-right corner. Lane positions are:
- **Top Lane**: Upper-left area of the minimap (northwest side)
- **Mid Lane**: Diagonal line through the center (bottom-left to top-right)
- **Bot Lane**: Lower-right area of the minimap (southeast side)

【Player Information】
- User's Champion: ${matchContext.myChampion}
- User's Assigned Lane: **${roleLabel}**
- Allied Team: ${matchContext.allies.join(', ')}
- Enemy Team: ${matchContext.enemies.join(', ')}
- Gold Difference: ${matchContext.goldDiff}G

【Scene to Analyze】
- Type: ${segment.type}
- Timestamp: ${segment.targetTimestampStr}
- What happened: ${segment.eventDescription}

【Basic Macro Concepts (use these to explain)】
- Push and Rotate: Push wave to enemy tower before rotating
- Cross-mapping: Take resources on the opposite side of where enemies are
- Slow Push: Slow push → Crash → Catch in middle → Repeat
- Split Push: Apply pressure in a side lane
- Objective Setup: Push waves before objective spawns to position

【Output Format (JSON)】
{
    "observation": {
        "userPosition": "${matchContext.myChampion} farming in ${roleLabel}",
        "allyPositions": "Describe ally positions",
        "enemyPositions": "Visible enemy positions (mark unknown if not visible)",
        "waveState": "Wave state for each lane",
        "objectiveState": "Objective status"
    },
    "winningPattern": {
        "title": "Title of the winning pattern",
        "steps": ["Step 1", "Step 2", "Step 3"],
        "macroConceptUsed": "Macro concept name used"
    },
    "gap": {
        "description": "Gap between actual play and winning pattern",
        "criticalMoment": "When the decision should have been different",
        "whatShouldHaveDone": "Specifically what should have been done"
    }
}`,

        ko: `당신은 League of Legends의 매크로 전략(맵 전체의 움직임, 로테이션, 오브젝트 컨트롤)에 특화된 전문 코치입니다.

**모든 분석 텍스트를 한국어로 출력하세요.**

【중요: 분석 포커스】
- **매크로만**: 마이크로(조작, 스킬 정확도)에 대해 언급하지 마세요
- **미니맵 확인**: 모든 챔피언 위치와 웨이브 위치를 확인
- **"승리 패턴" 제시**: 이 상황에서 무엇을 해야 했는지 구체적으로

【미니맵 읽는 법 - 매우 중요】
미니맵은 화면 오른쪽 하단에 표시됩니다. 라인 위치는 다음과 같습니다:
- **탑 라인**: 미니맵의 **왼쪽 상단** 영역(북서쪽)
- **미드 라인**: 미니맵 **중앙을 대각선**으로 가로지르는 라인
- **봇 라인**: 미니맵의 **오른쪽 하단** 영역(남동쪽)

【플레이어 정보】
- 유저의 챔피언: ${matchContext.myChampion}
- 유저의 담당 라인: **${roleLabel}**
- 아군 팀: ${matchContext.allies.join(', ')}
- 적 팀: ${matchContext.enemies.join(', ')}
- 골드 차이: ${matchContext.goldDiff}G

【분석 대상 장면】
- 타입: ${segment.type}
- 타임스탬프: ${segment.targetTimestampStr}
- 발생한 일: ${segment.eventDescription}

【매크로 기본 개념 (이것들을 사용하여 설명하세요)】
- Push and Rotate: 웨이브를 적 타워로 밀고 로테이션
- Cross-mapping: 적이 있는 곳의 반대편에서 자원 획득
- Slow Push: 슬로우 푸시 → 크래시 → 중앙에서 받기 → 반복
- Split Push: 사이드 라인에서 압박
- Objective Setup: 오브젝트 스폰 전에 웨이브를 밀어 포지셔닝

【출력 형식 (JSON)】
{
    "observation": {
        "userPosition": "${matchContext.myChampion}이(가) ${roleLabel}에서 파밍 중",
        "allyPositions": "아군 위치 설명",
        "enemyPositions": "보이는 적 위치(안 보이면 위치 불명)",
        "waveState": "각 라인의 웨이브 상태",
        "objectiveState": "오브젝트 상태"
    },
    "winningPattern": {
        "title": "승리 패턴의 제목",
        "steps": ["스텝 1", "스텝 2", "스텝 3"],
        "macroConceptUsed": "사용한 매크로 개념명 (영어로)"
    },
    "gap": {
        "description": "실제 플레이와의 차이",
        "criticalMoment": "판단을 바꿔야 했던 타이밍",
        "whatShouldHaveDone": "구체적으로 해야 했던 것"
    }
}`
    };

    return prompts[language];
}

export function generateOverallSummary(segments: SegmentAnalysis[], language: 'ja' | 'en' | 'ko' = 'ja'): {
    mainIssue: string;
    homework: {
        title: string;
        description: string;
        howToCheck: string;
        relatedTimestamps: string[];
    };
} {
    const noDataMessages = {
        ja: { mainIssue: '分析データがありません', title: '再度分析を実行してください' },
        en: { mainIssue: 'No analysis data available', title: 'Please run the analysis again' },
        ko: { mainIssue: '분석 데이터가 없습니다', title: '다시 분석을 실행해주세요' }
    };

    if (segments.length === 0) {
        return {
            mainIssue: noDataMessages[language].mainIssue,
            homework: {
                title: noDataMessages[language].title,
                description: '',
                howToCheck: '',
                relatedTimestamps: []
            }
        };
    }

    // Count macro concepts mentioned
    const conceptCounts: Record<string, number> = {};
    for (const seg of segments) {
        const concept = seg.winningPattern?.macroConceptUsed || '';
        if (concept) {
            conceptCounts[concept] = (conceptCounts[concept] || 0) + 1;
        }
    }

    // Find most common issue
    const mostCommonConcept = Object.entries(conceptCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Push and Rotate';

    // Generate summary based on segment types
    const hasObjectiveIssues = segments.some(s => s.type === 'OBJECTIVE');
    const hasDeathIssues = segments.some(s => s.type === 'DEATH');

    const mainIssueMessages = {
        ja: {
            both: 'オブジェクト前の準備不足とポジショニングミスが連動して負けパターンを作っています',
            objective: 'オブジェクトタイマーを意識した事前準備（ウェーブプッシュ、ポジショニング）が不足しています',
            death: 'マップ全体の状況を見ずに単独行動してデスするパターンが見られます',
            other: 'マクロの意思決定タイミングを改善する必要があります'
        },
        en: {
            both: 'Lack of objective preparation and positioning mistakes are creating a losing pattern',
            objective: 'Need better preparation before objectives (wave push, positioning)',
            death: 'Getting caught alone without checking the full map situation',
            other: 'Macro decision timing needs improvement'
        },
        ko: {
            both: '오브젝트 사전 준비 부족과 포지셔닝 실수가 연결되어 패배 패턴을 만들고 있습니다',
            objective: '오브젝트 타이머를 의식한 사전 준비(웨이브 푸시, 포지셔닝)가 부족합니다',
            death: '맵 전체 상황을 확인하지 않고 단독 행동하여 죽는 패턴이 보입니다',
            other: '매크로 의사결정 타이밍을 개선할 필요가 있습니다'
        }
    };

    let mainIssue = '';
    if (hasObjectiveIssues && hasDeathIssues) {
        mainIssue = mainIssueMessages[language].both;
    } else if (hasObjectiveIssues) {
        mainIssue = mainIssueMessages[language].objective;
    } else if (hasDeathIssues) {
        mainIssue = mainIssueMessages[language].death;
    } else {
        mainIssue = mainIssueMessages[language].other;
    }

    // Extract related timestamps from segments that use the most common concept
    const relatedTimestamps = segments
        .filter(seg => seg.winningPattern?.macroConceptUsed === mostCommonConcept)
        .map(seg => seg.timestamp)
        .slice(0, 5); // Max 5 timestamps

    return {
        mainIssue,
        homework: {
            title: mostCommonConcept,
            description: getHomeworkDescription(mostCommonConcept, language),
            howToCheck: getHomeworkCheckCriteria(mostCommonConcept, language),
            relatedTimestamps
        }
    };
}

function getHomeworkDescription(concept: string, language: 'ja' | 'en' | 'ko' = 'ja'): string {
    const descriptions: Record<string, Record<string, string>> = {
        'Push and Rotate': {
            ja: 'ローテーションする前に必ずウェーブを敵タワーに押し切る。これにより敵にジレンマを与え、自分は安全に移動できる。',
            en: 'Always push the wave to the enemy tower before rotating. This creates a dilemma for the enemy and allows safe movement.',
            ko: '로테이션 전에 반드시 웨이브를 적 타워까지 밀어야 합니다. 이렇게 하면 적에게 딜레마를 주고 안전하게 이동할 수 있습니다.'
        },
        'クロスマッピング': {
            ja: '敵が5人でプッシュしている時は、同じ場所に行かず反対サイドでタワーやファームを取る。',
            en: 'When 5 enemies are pushing together, take resources on the opposite side instead of meeting them.',
            ko: '적 5명이 함께 푸시할 때는 같은 곳으로 가지 말고 반대편에서 타워나 파밍을 합니다.'
        },
        '2ウェーブサイクル': {
            ja: '第1ウェーブでスロープッシュ→第2ウェーブでクラッシュ→次は中央で受ける、を繰り返す。',
            en: 'Slow push wave 1 → crash wave 2 → catch in the middle → repeat cycle.',
            ko: '1웨이브 슬로우 푸시 → 2웨이브 크래시 → 다음은 중앙에서 받기 → 반복'
        },
        'Hit-and-Run': {
            ja: 'タワーを一気に取ろうとせず、少し削って離脱→防御バフが切れたら戻る、を繰り返す。',
            en: 'Don\'t try to take tower at once. Chip damage → back off → return when plates drop.',
            ko: '타워를 한 번에 부수려 하지 말고, 조금 깎고 후퇴 → 방어 버프가 사라지면 돌아가기를 반복합니다.'
        },
        'オブジェクト準備': {
            ja: 'ドラゴン/バロンスポーン1分前にはウェーブを押し、30秒前にはオブジェクト周辺にいる。',
            en: 'Push waves 1 minute before Dragon/Baron spawn, be at objective 30 seconds before.',
            ko: '드래곤/바론 스폰 1분 전에 웨이브를 밀고, 30초 전에는 오브젝트 주변에 있어야 합니다.'
        }
    };

    const defaultMsg = {
        ja: 'マクロの基本概念を意識してプレイする',
        en: 'Focus on basic macro concepts',
        ko: '매크로의 기본 개념을 의식하며 플레이하세요'
    };

    return descriptions[concept]?.[language] || defaultMsg[language];
}

function getHomeworkCheckCriteria(concept: string, language: 'ja' | 'en' | 'ko' = 'ja'): string {
    const criteria: Record<string, Record<string, string>> = {
        'Push and Rotate': {
            ja: '次の試合で、ローテーション前にウェーブを押せた回数を数える（目標: 5回以上）',
            en: 'Count how many times you pushed wave before rotating (Goal: 5+ times)',
            ko: '다음 게임에서 로테이션 전에 웨이브를 밀은 횟수를 세세요 (목표: 5회 이상)'
        },
        'クロスマッピング': {
            ja: 'ビハインド時に敵と同じ場所でファイトした回数を0にする',
            en: 'Avoid fighting where enemies are grouped when behind (Goal: 0 times)',
            ko: '뒤처졌을 때 적과 같은 곳에서 싸운 횟수를 0으로 만드세요'
        },
        '2ウェーブサイクル': {
            ja: 'レーン戦でスロープッシュ→クラッシュのサイクルを3回以上成功させる',
            en: 'Complete slow push → crash cycle 3+ times in laning phase',
            ko: '라인전에서 슬로우 푸시 → 크래시 사이클을 3회 이상 성공시키세요'
        },
        'Hit-and-Run': {
            ja: 'タワーダイブで死んだ回数を0にする',
            en: 'Zero deaths from tower dives',
            ko: '타워 다이브로 죽은 횟수를 0으로 만드세요'
        },
        'オブジェクト準備': {
            ja: 'オブジェクトスポーン時にピット周辺にいた割合を50%以上にする',
            en: 'Be at objective pit 50%+ of the time when objectives spawn',
            ko: '오브젝트 스폰 시 피트 주변에 있는 비율을 50% 이상으로 만드세요'
        }
    };

    const defaultMsg = {
        ja: '次の試合で意識してプレイする',
        en: 'Focus on this in your next game',
        ko: '다음 게임에서 이것을 의식하며 플레이하세요'
    };

    return criteria[concept]?.[language] || defaultMsg[language];
}
