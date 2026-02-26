# Trends Analysis

Show daily activity, model delegation trends, and cost patterns over time.

## Usage

- `/ork:analytics trends` — default 7 days
- `/ork:analytics trends 30` — last 30 days

## Step 1: Daily Activity (sessions, messages, tool calls)

```bash
jq '.dailyActivity[-7:]' ~/.claude/stats-cache.json
```

## Step 2: Daily Model Token Breakdown

```bash
jq '.dailyModelTokens[-7:] | .[] | {
  date: .date,
  models: (.tokensByModel | to_entries | map({model: .key, tokens: .value}) | sort_by(-.tokens))
}' ~/.claude/stats-cache.json
```

## Step 3: Peak Productivity Hours

```bash
jq '.hourCounts | to_entries | sort_by(-.value) | .[0:5] | map({
  hour: (.key + ":00"),
  sessions: .value
})' ~/.claude/stats-cache.json
```

## Step 4: All-Time Stats

```bash
jq '{
  totalSessions: .totalSessions,
  totalMessages: .totalMessages,
  longestSession: {
    id: .longestSession.sessionId,
    duration_min: (.longestSession.duration / 60000 | floor),
    messages: .longestSession.messageCount
  }
}' ~/.claude/stats-cache.json
```

## Presentation Format

```markdown
## Trends -- Last 7 Days

### Daily Activity
| Date | Sessions | Messages | Tools | Est. Cost |
|------|----------|----------|-------|-----------|
| Feb 12 | 6 | 1,200 | 450 | $2.10 |
| Feb 13 | 5 | 980 | 380 | $1.85 |
| ... | ... | ... | ... | ... |
| **Total** | **42** | **8,380** | **3,390** | **$18.50** |

### Model Delegation Trend
| Date | opus | sonnet | haiku |
|------|------|--------|-------|
| Feb 12 | 452K | 31K | -- |
| Feb 13 | 380K | 25K | 12K |
| ... | ... | ... | ... |

### Peak Productivity Hours
| Hour | Sessions |
|------|----------|
| 10:00 | 78 |
| 9:00 | 71 |
| 14:00 | 65 |

### All-Time Stats
- **Total sessions:** [N]
- **Total messages:** [N]
- **Longest session:** [id] -- [N] min, [N] messages
```

## Cost Per Day

Apply pricing from `references/cost-estimation.md` to daily token counts:
- Split daily tokens by model
- Apply per-model pricing (70/30 input/output estimate for daily totals)
- Show daily cost in the activity table
