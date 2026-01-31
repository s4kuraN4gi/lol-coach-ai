# LoL Coach AI - Future Features Roadmap

## Planned Features (Pending User Base Growth)

### Rank Comparison Widget (同ランク比較)
**Status**: Pending (requires sufficient user base)

**Description**:
Compare user's stats against anonymous aggregated statistics from other users in the same rank tier.

**Comparison Metrics** (proposed):
- KDA
- CS/min
- Vision Score/min
- Damage/min
- Kill Participation
- Objective Damage

**Prerequisites**:
- Sufficient active user base for meaningful statistical comparison
- Anonymous data aggregation system
- Privacy-compliant data collection

**Data Source**: All users' anonymized statistics stored in the database

**UI Concept**:
```
┌─────────────────────────────────┐
│ ゴールド4の平均と比較           │
│ KDA:    3.2 (上位35%) ↑        │
│ CS/分:  6.8 (上位42%) →        │
│ 視界:   18  (下位60%) ↓ 改善！ │
└─────────────────────────────────┘
```

**Notes**:
- Discussed on 2026-02-02
- Will implement once user base is large enough for meaningful comparisons
