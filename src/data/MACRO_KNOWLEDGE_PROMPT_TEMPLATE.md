# Macro Knowledge JSON Structuring Prompt Template

このプロンプトテンプレートを使用して、外部から収集したLoLマクロ知識をmacro_knowledge.jsonの形式に構造化できます。

## 使用方法

1. 外部ソース（ガイド、動画、プロ解説など）からマクロ知識をテキストでコピー
2. 以下のプロンプトにそのテキストを貼り付け
3. LLM（Claude、GPT-4など）に投げて構造化されたJSONを取得
4. 出力をmacro_knowledge.jsonにマージ

---

## プロンプトテンプレート

```
あなたはLoL（League of Legends）のマクロ戦略エキスパートです。
以下の入力テキストを分析し、指定されたJSONスキーマに従って構造化してください。

### 出力JSONスキーマ

macro_knowledge.jsonには以下のセクションがあります。入力内容に応じて、適切なセクションのJSONを出力してください。

#### 1. objective_response（オブジェクト対応）
オブジェクト（バロン、ドラゴン、ヘラルド、グラブス）に関する戦略的知識。

```json
{
  "OBJECTIVE_NAME": {
    "description": "オブジェクトの説明（出現時間、効果など）",
    "when_enemy_starts": {
      "gold_behind_large": {
        "threshold": -5000,
        "situation": "状況の説明",
        "recommended_action": "SPLIT_PUSH_OPPOSITE | CONTEST_WITH_VISION | FORCE_FIGHT_OR_STEAL | TRADE_OBJECTIVE",
        "reasoning": "なぜこの行動が推奨されるかの理由",
        "role_specific": {
          "TOP": "トップレーナー向けの具体的アドバイス",
          "JUNGLE": "ジャングラー向けの具体的アドバイス",
          "MIDDLE": "ミッドレーナー向けの具体的アドバイス",
          "BOTTOM": "ADC向けの具体的アドバイス",
          "UTILITY": "サポート向けの具体的アドバイス"
        },
        "common_mistakes": [
          "よくある間違い1",
          "よくある間違い2"
        ]
      },
      "gold_behind_small": { ... },
      "gold_even": { ... },
      "gold_ahead_small": { ... },
      "gold_ahead_large": { ... }
    },
    "when_ally_secures": {
      "recommended_action": "推奨アクション",
      "reasoning": "理由",
      "priorities": ["優先事項1", "優先事項2"]
    },
    "when_enemy_secures": {
      "recommended_action": "推奨アクション",
      "reasoning": "理由",
      "priorities": ["優先事項1", "優先事項2"]
    }
  }
}
```

有効なOBJECTIVE_NAME: BARON_NASHOR, DRAGON, RIFT_HERALD, HORDE, ELDER_DRAGON
有効なrecommended_action: SPLIT_PUSH_OPPOSITE, CONTEST_WITH_VISION, FORCE_FIGHT_OR_STEAL, TRADE_OBJECTIVE, MUST_CONTEST, SIEGE_OR_SPLIT, MAINTAIN_PRESSURE, PREPARE_DEFENSE_OR_TRADE

#### 2. game_state_strategy（ゲーム状況別戦略）
ゴールド差に応じた全体的な戦略。

```json
{
  "state_name": {
    "gold_threshold": -7000,
    "description": "状態の説明（例：大きくビハインド）",
    "general_strategy": "この状況での基本戦略",
    "priorities": [
      "優先事項1",
      "優先事項2",
      "優先事項3"
    ],
    "avoid": [
      "避けるべきこと1",
      "避けるべきこと2"
    ],
    "role_specific": {
      "TOP": "ロール別アドバイス",
      "JUNGLE": "...",
      "MIDDLE": "...",
      "BOTTOM": "...",
      "UTILITY": "..."
    }
  }
}
```

有効なstate_name: losing_hard, losing_slightly, even, winning_slightly, winning_hard
gold_threshold目安: -7000(大負け), -3000(少し負け), 0(互角), 3000(少し勝ち), 7000(大勝ち)

#### 3. time_phase_priorities（ゲームフェーズ別優先事項）
時間帯別の戦略とロール別フォーカス。

```json
{
  "phase_name": {
    "time_range": "0-14分",
    "description": "フェーズの説明",
    "priorities": [
      "優先事項1",
      "優先事項2"
    ],
    "role_focus": {
      "TOP": "このフェーズでのトップの役割",
      "JUNGLE": "...",
      "MIDDLE": "...",
      "BOTTOM": "...",
      "UTILITY": "..."
    },
    "key_concept": "このフェーズで最も重要な概念（任意）"
  }
}
```

有効なphase_name: early_game(0-14分), mid_game(14-25分), late_game(25分以降)

#### 4. common_macro_mistakes（よくあるマクロミス）
プレイヤーがよく犯すマクロ判断のミス。

```json
{
  "mistake_id": {
    "description": "ミスの短い説明",
    "explanation": "なぜこれが問題なのか、どのような状況で起きるか",
    "advice": "どうすれば避けられるか、改善方法",
    "examples": ["具体例1", "具体例2"],
    "related_roles": ["TOP", "JUNGLE"]
  }
}
```

mistake_idは snake_case で命名（例: dying_before_objective, wrong_objective_priority）

### 出力ルール

1. **日本語で出力**: すべての説明、アドバイスは日本語で記述
2. **具体的に**: 曖昧な表現を避け、具体的な行動を記述
3. **ロール別**: 可能な限りロール別（TOP/JG/MID/BOT/SUP）のアドバイスを含める
4. **根拠を含める**: reasoningやexplanationには「なぜ」を明確に記述
5. **実用的**: プレイヤーが試合中に実践できる具体的なアドバイスにする
6. **JSONのみ出力**: 説明文なしで、純粋なJSONブロックのみを出力

### 入力テキスト

---
[ここに外部から収集したマクロ知識のテキストを貼り付け]
---

上記のテキストを分析し、最も適切なセクションのJSON形式で出力してください。
複数のセクションに該当する場合は、それぞれのセクションごとにJSONブロックを分けて出力してください。
```

---

## 入力テキストの例と出力例

### 例1: バロンに関する知識

**入力:**
```
バロンが沸いたとき、5000ゴールド以上負けてる状況でコンテストするのはまじで意味ない。
ADCとか一瞬で溶けるし。そういうときは反対サイドにスプリットしてタワー取るのが正解。
特にトップはTP持ってるならボットレーン押しながら状況見るのがいい。
サポートはバロンピット付近に無理に入ってワードを置こうとして死ぬパターンが多い。安全に置けるところだけでいい。
```

**出力:**
```json
{
  "BARON_NASHOR": {
    "when_enemy_starts": {
      "gold_behind_large": {
        "threshold": -5000,
        "situation": "5000g以上ビハインドで敵がバロンを開始",
        "recommended_action": "SPLIT_PUSH_OPPOSITE",
        "reasoning": "大きなゴールド差ではコンテストしても集団戦で負ける可能性が高い。バロンを渡す代わりに反対サイドでタワーを獲得することで、マップ上の損失を最小限に抑える。",
        "role_specific": {
          "TOP": "TPを温存しつつボットレーンをプッシュ。敵がバロン後に5人で寄ってくる前にタワーを折る。状況次第でTPでチームに合流。",
          "JUNGLE": "無理なスティールは避ける。味方のスプリットをサポートするか、安全にビジョンを確保。",
          "MIDDLE": "最もプッシュしやすいサイドレーンを押す。敵が5人でバロンなら中途半端に寄らない。",
          "BOTTOM": "可能な限りウェーブをプッシュしてからトップサイドに移動。無理なコンテストは避ける。",
          "UTILITY": "バロンピット周辺への無理なワード設置は厳禁。安全に置ける範囲でビジョンを確保し、絶対にデスを避ける。"
        },
        "common_mistakes": [
          "全員でバロンに寄って集団戦で全滅する",
          "サポートが無理にワードを置こうとして単独でデス",
          "何もオブジェクトを取らずにバロンを渡す"
        ]
      }
    }
  }
}
```

### 例2: 新しいマクロミスの追加

**入力:**
```
よく見るのが、敵のジャングラーが見えてないのにドラゴン始めるやつ。
スマイトコンテストされてドラゴン取られるだけじゃなく、そのまま集団戦で負けるパターン。
敵JGの位置が分からないなら、まずビジョン取るか、敵JGが反対サイドにいることを確認してからドラゴン触るべき。
```

**出力:**
```json
{
  "starting_objective_without_jg_vision": {
    "description": "敵ジャングラーの位置不明時にオブジェクトを開始",
    "explanation": "敵ジャングラーの位置が不明な状態でドラゴンやバロンを開始すると、スマイトコンテストでオブジェクトを取られるリスクがある。さらに、敵チームが合流してきた場合、オブジェクトにダメージを受けた状態で不利な集団戦を強いられる。",
    "advice": "オブジェクトを開始する前に、敵ジャングラーの位置を確認する。①敵JGがマップの反対側で見えている ②敵JGがデスしている ③敵JGのキャンプ位置をワードで確認した、のいずれかの条件を満たしてから開始する。",
    "examples": [
      "敵JGがトップサイドで見えていないのにドラゴンを開始し、スマイトスティールされる",
      "敵JGがどこにいるか分からないままバロンを始め、エンゲージされて全滅"
    ],
    "related_roles": ["JUNGLE", "UTILITY"]
  }
}
```

### 例3: 時間帯戦略の更新

**入力:**
```
ミッドゲームで一番大事なのはビジョンコントロール。
特にジャングラーとサポートは、次のオブジェクトが沸く1分前からピット周辺のビジョンを争う必要がある。
ADCはチームと一緒に動くのが基本だけど、ウェーブが来たらファームを取りに行く。ただし、オブジェクト沸く30秒前にはチームに戻る。
```

**出力:**
```json
{
  "mid_game": {
    "time_range": "14-25分",
    "description": "オブジェクトファイトフェーズ",
    "priorities": [
      "オブジェクトスポーン1分前からのビジョンコントロール",
      "チームとしての集団行動",
      "ウェーブ管理とファーム効率のバランス"
    ],
    "role_focus": {
      "TOP": "TPを活用してサイドレーンを押しつつ、オブジェクトファイトに参加",
      "JUNGLE": "次のオブジェクトスポーン1分前からビジョンコントロール開始。ピット周辺の視界争いをリード。",
      "MIDDLE": "サイドレーンへのローテーションとチームファイト参加のバランス",
      "BOTTOM": "基本はチームと行動。ウェーブが来たらファームに行くが、オブジェクト30秒前には必ずチームに戻る。",
      "UTILITY": "ジャングラーと協力してオブジェクト周辺のビジョンを確保。コントロールワードを惜しまない。"
    }
  }
}
```

---

## 複数ソースからの情報をマージする際の注意点

1. **重複確認**: 既存のmacro_knowledge.jsonに同様の内容がないか確認
2. **整合性**: 既存の内容と矛盾しないか確認（矛盾する場合はより信頼性の高いソースを採用）
3. **粒度の統一**: 既存の記述レベルと同程度の詳しさに調整
4. **テスト**: 新しい知識を追加した後、実際のコーチング出力で効果を確認

## JSONのバリデーション

出力されたJSONをmacro_knowledge.jsonにマージする前に、以下を確認：

```bash
# JSONの構文チェック
node -e "JSON.parse(require('fs').readFileSync('./src/data/macro_knowledge.json'))"
```

問題なければ、既存のファイルに追記またはマージしてください。
