# Memory Health

## Overview

OrchestKit uses a 3-tier memory architecture. Doctor validates all tiers with automated checks.

## Memory Tiers

| Tier | Plugin | Status | Check |
|------|--------|--------|-------|
| 1. Graph | ork-lite | Always available | Directory + JSONL integrity |
| 2. Mem0 | ork | Optional (needs API key) | API key + queue depth |
| 3. Fabric | ork-lite | Orchestrates tiers 1+2 | Both tiers available |

## Automated Health Check

The `memory-health.ts` library provides `checkMemoryHealth()` which returns a `MemoryHealthReport`:

```typescript
interface MemoryHealthReport {
  overall: 'healthy' | 'degraded' | 'unavailable';
  timestamp: string;
  tiers: {
    graph: {
      status: TierStatus;
      memoryDir: boolean;        // .claude/memory/ exists
      decisions: FileHealth;     // decisions.jsonl analysis
      graphQueue: FileHealth;    // graph-queue.jsonl depth
    };
    mem0: {
      status: TierStatus;
      apiKeyPresent: boolean;    // MEM0_API_KEY env var
      mem0Queue: FileHealth;     // mem0-queue.jsonl depth
      lastSyncTimestamp: string | null;
    };
    fabric: {
      status: TierStatus;
      bothTiersAvailable: boolean;
    };
  };
}
```

Each `FileHealth` includes: `exists`, `lineCount`, `corruptLines`, `sizeBytes`, `lastModified`.

## Status Meanings

| Status | Meaning |
|--------|---------|
| `healthy` | Tier operational, no issues |
| `degraded` | Tier working but with issues (corrupt data, high queue depth) |
| `unavailable` | Tier not configured or missing critical components |

## Tier 1: Graph Memory

Local knowledge graph stored in `.claude/memory/`.

### Validation Commands

```bash
# Check directory exists
ls -la .claude/memory/

# Count decisions
wc -l .claude/memory/decisions.jsonl

# Check graph queue depth
wc -l .claude/memory/graph-queue.jsonl 2>/dev/null

# Validate JSONL integrity (each line must be valid JSON)
while IFS= read -r line; do
  echo "$line" | python3 -m json.tool > /dev/null 2>&1 || echo "CORRUPT: $line"
done < .claude/memory/decisions.jsonl
```

### Health Indicators

- Directory exists: `.claude/memory/`
- `decisions.jsonl`: Valid JSONL, no corrupt lines
- `graph-queue.jsonl`: Queue depth < 50 (high depth = sync backlog)
- No corruption: every line parses as valid JSON

### Degraded Conditions

- **Corrupt lines**: One or more JSONL lines fail to parse
- **High queue depth**: >50 pending graph operations (sync backlog)
- **Missing directory**: Graph memory never initialized

## Tier 2: Mem0 Cloud

Optional cloud memory for cross-session persistence.

### Validation Commands

```bash
# Check API key presence
[ -n "$MEM0_API_KEY" ] && echo "Mem0 available" || echo "Mem0 disabled (optional)"

# Check mem0 queue depth
wc -l .claude/memory/mem0-queue.jsonl 2>/dev/null

# Check last sync from analytics
tail -1 .claude/logs/mem0-analytics.jsonl 2>/dev/null
```

### Health Indicators

- API key present: `MEM0_API_KEY` env var
- `mem0-queue.jsonl`: Queue depth < 50
- Last sync timestamp in analytics log
- Graceful fallback: works without key

### Degraded Conditions

- **High queue depth**: >50 pending mem0 operations
- **No recent sync**: Last analytics entry is old

## Tier 3: Memory Fabric

Orchestrates Graph + Mem0 with deduplication and cross-reference boosting.

### Health Indicators

- Both graph AND mem0 tiers available
- Session registry active
- Result merging from both tiers

## Troubleshooting

### Graph memory missing

```bash
# Initialize graph
mkdir -p .claude/memory
```

The first `/ork:remember` call will create `decisions.jsonl`.

### Corrupt JSONL lines

```bash
# Find corrupt lines
python3 -c "
import json, sys
with open('.claude/memory/decisions.jsonl') as f:
    for i, line in enumerate(f, 1):
        try: json.loads(line)
        except: print(f'Line {i}: {line.strip()[:80]}')
"
```

### High queue depth

Queue items accumulate if the stop dispatcher doesn't run (e.g., session crash). The queue-recovery hook processes orphaned queues on the next session start.

### Mem0 not connecting

1. Verify API key: `echo $MEM0_API_KEY | head -c 10`
2. Check network access
3. Review Mem0 dashboard for rate limits

### Fabric not merging

Check that both graph and mem0 tiers show as healthy. Fabric requires both to be available.
