---
title: Stream large analytics files with jq instead of slurping to prevent OOM crashes
impact: HIGH
impactDescription: "Using jq -s (slurp) on analytics files over 50MB loads the entire file into memory, causing OOM crashes — use streaming jq without -s for large files"
tags: jq, streaming, performance, rotation, large-files
---

## Large File Streaming

Handle large JSONL files (>50MB) with streaming queries and rotation-aware patterns.

**Incorrect — slurping large files into memory:**
```bash
# WRONG: -s loads entire file into memory — OOM on 500MB file
jq -s 'group_by(.agent) | map({agent: .[0].agent, count: length})' ~/.claude/analytics/agent-usage.jsonl
```

**Correct — streaming without slurp:**
```bash
# RIGHT: stream-process line by line, then aggregate
jq -r '.agent' ~/.claude/analytics/agent-usage.jsonl | sort | uniq -c | sort -rn

# RIGHT: for complex aggregations, use reduce
jq -n '[inputs | .agent] | group_by(.) | map({agent: .[0], count: length}) | sort_by(-.count)' ~/.claude/analytics/agent-usage.jsonl
```

**Including rotated files for historical queries:**
```bash
# Rotated files follow pattern: <name>.<YYYY-MM>.jsonl
# Include all months for full history
jq -r '.agent' ~/.claude/analytics/agent-usage.*.jsonl ~/.claude/analytics/agent-usage.jsonl 2>/dev/null | sort | uniq -c | sort -rn
```

**Key rules:**
- Check file size before querying: `ls -lh` the target file
- Files >50MB: use streaming `jq` without `-s` (slurp) flag
- Files <50MB: `-s` is fine for `group_by` operations
- Include rotated files (`*.YYYY-MM.jsonl`) when user asks for historical data
- For date-range queries, filter by `ts` field before aggregating
