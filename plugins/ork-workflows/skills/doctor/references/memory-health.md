# Memory Health

## Overview

OrchestKit uses a 3-tier memory architecture. Doctor validates all tiers.

## Memory Tiers

| Tier | Plugin | Status |
|------|--------|--------|
| 1. Graph | ork-memory-graph | Always available |
| 2. Mem0 | ork-memory-mem0 | Optional (needs API key) |
| 3. Fabric | ork-memory-fabric | Orchestrates tiers 1+2 |

## Tier 1: Graph Memory

Local knowledge graph stored in `.claude/memory/`.

### Validation

```bash
# Check graph files exist
ls -la .claude/memory/

# Check graph structure
cat .claude/memory/graph.json | jq '.nodes | length'
```

### Health Indicators

- Directory exists: `.claude/memory/`
- Graph queryable: nodes/edges intact
- No corruption: valid JSON

## Tier 2: Mem0 Cloud

Optional cloud memory for cross-session persistence.

### Validation

```bash
# Check API key presence
[ -n "$MEM0_API_KEY" ] && echo "Mem0 available" || echo "Mem0 disabled"
```

### Health Indicators

- API key present: `MEM0_API_KEY` env var
- API reachable: network connectivity
- Graceful fallback: works without key

## Tier 3: Memory Fabric

Orchestrates Graph + Mem0 with deduplication.

### Validation

- Fabric initialization on session start
- Result merging from both tiers
- Cross-reference boosting active

## Quick Checks

```bash
# Graph health
test -d .claude/memory && echo "Graph: OK" || echo "Graph: MISSING"

# Mem0 health
test -n "$MEM0_API_KEY" && echo "Mem0: OK" || echo "Mem0: DISABLED (optional)"
```

## Troubleshooting

### Graph memory missing

```bash
# Initialize graph
mkdir -p .claude/memory
echo '{"nodes":[],"edges":[]}' > .claude/memory/graph.json
```

### Mem0 not connecting

1. Verify API key: `echo $MEM0_API_KEY`
2. Check network access
3. Review Mem0 dashboard for rate limits

### Fabric not merging

Check load-context hook is running on SessionStart.
