# Memory Health

## Overview

OrchestKit uses graph memory for knowledge persistence. Doctor validates it with automated checks.

## Automated Health Check

The `memory-health.ts` library provides `checkMemoryHealth()` which returns a `MemoryHealthReport`:

```typescript
interface MemoryHealthReport {
  overall: 'healthy' | 'degraded' | 'unavailable';
  timestamp: string;
  graph: {
    status: TierStatus;
    memoryDir: boolean;        // .claude/memory/ exists
    decisions: FileHealth;     // decisions.jsonl analysis
    graphQueue: FileHealth;    // graph-queue.jsonl depth
  };
}
```

Each `FileHealth` includes: `exists`, `lineCount`, `corruptLines`, `sizeBytes`, `lastModified`.

## Status Meanings

| Status | Meaning |
|--------|---------|
| `healthy` | Graph memory operational, no issues |
| `degraded` | Working but with issues (corrupt data, high queue depth) |
| `unavailable` | Not configured or missing critical components |

## Graph Memory

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

## Auto-Memory Index Budget

Separate from the graph store above: the harness injects a per-project
**auto-memory index** (`MEMORY.md`) into context every session. If its index
lines grow unbounded it both wastes tokens and — because it changes when
memories are written — busts the prompt cache. CC ships a generic over-budget
warning; this check makes it actionable by pointing at the fix (`/ork:dream`).

The index lives under `~/.claude/projects/<encoded-cwd>/memory/MEMORY.md`
(the harness encodes the project path by replacing `/` with `-`).

```bash
# Auto-memory index budget check
MEM_DIR="$HOME/.claude/projects/$(echo "$PWD" | sed 's|/|-|g')/memory"
MEM_INDEX="$MEM_DIR/MEMORY.md"
BUDGET=24986   # 24.4 KB — the harness's index budget

if [ -f "$MEM_INDEX" ]; then
  bytes=$(wc -c < "$MEM_INDEX" | tr -d ' ')
  # index lines over ~200 chars are the usual re-bloat cause
  long=$(awk 'length > 200 && /^- \[/' "$MEM_INDEX" | wc -l | tr -d ' ')
  if [ "$bytes" -gt "$BUDGET" ]; then
    echo "WARN: MEMORY.md index ${bytes}B > ${BUDGET}B budget — run /ork:dream to consolidate"
  elif [ "$long" -gt 0 ]; then
    echo "WARN: ${long} index line(s) > 200 chars — run /ork:dream (re-bloat risk)"
  else
    echo "OK: MEMORY.md index within budget (${bytes}B)"
  fi
fi
```

### Health Indicators

- Index size ≤ 24.4 KB (the harness budget)
- Every index line ≤ ~200 chars (detail belongs in the linked topic file, not the index)
- Fix for both: `/ork:dream` rebuilds the index, capping line length and pruning stale entries

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
