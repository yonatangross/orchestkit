#!/usr/bin/env bash
# perf-compare.sh — before/after perf-snapshot comparison (#946)
#
# Usage:
#   ./scripts/perf-compare.sh before.json after.json
#   ./scripts/perf-compare.sh ~/.claude/perf/snap-2026-03-04-08.json \
#                             ~/.claude/perf/snap-2026-03-04-10.json
#
# Exit codes:
#   0 — no regression (after ≤ before total tokens)
#   1 — regression detected (after > before total tokens)

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <before.json> <after.json>" >&2
  exit 2
fi

BEFORE="$1"
AFTER="$2"

if [[ ! -f "$BEFORE" ]]; then echo "Error: before file not found: $BEFORE" >&2; exit 2; fi
if [[ ! -f "$AFTER"  ]]; then echo "Error: after file not found: $AFTER"   >&2; exit 2; fi

# Extract values using node (already available in CC environment)
read_snap() {
  local file="$1"
  node -e "
    const d = JSON.parse(require('fs').readFileSync('$file', 'utf8'));
    console.log([
      d.totalTokensInjected ?? 0,
      d.hookCount ?? 0,
      d.bucket ?? 'unknown',
      JSON.stringify(d.byCategory ?? {}),
      JSON.stringify(d.topCategories ?? [])
    ].join('|'));
  " 2>/dev/null || echo "0|0|unknown|{}|[]"
}

BEFORE_RAW="$(read_snap "$BEFORE")"
AFTER_RAW="$(read_snap "$AFTER")"

IFS='|' read -r B_TOKENS B_HOOKS B_BUCKET B_BY_CAT _ <<< "$BEFORE_RAW"
IFS='|' read -r A_TOKENS A_HOOKS A_BUCKET A_BY_CAT _ <<< "$AFTER_RAW"

DELTA=$(( A_TOKENS - B_TOKENS ))
if [[ "$B_TOKENS" -gt 0 ]]; then
  PCT=$(( DELTA * 100 / B_TOKENS ))
else
  PCT=0
fi

# ── Header ────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║            OrchestKit Perf Snapshot Comparison           ║"
echo "╠══════════════════════════════════════════════════════════╣"
printf "║  Before: %-47s║\n" "$B_BUCKET  ($BEFORE)"
printf "║  After:  %-47s║\n" "$A_BUCKET  ($AFTER)"
echo "╠══════════════════════════════════════════════════════════╣"
printf "║  Total before:  %7d tokens                           ║\n" "$B_TOKENS"
printf "║  Total after:   %7d tokens                           ║\n" "$A_TOKENS"

if [[ "$DELTA" -lt 0 ]]; then
  printf "║  Delta:         %7d tokens  (%+d%%)  ✅ IMPROVEMENT  ║\n" "$DELTA" "$PCT"
elif [[ "$DELTA" -gt 0 ]]; then
  printf "║  Delta:         %+7d tokens  (%+d%%)  ❌ REGRESSION   ║\n" "$DELTA" "$PCT"
else
  printf "║  Delta:              0 tokens  (0%%)   ✓  NO CHANGE    ║\n"
fi

printf "║  Hooks before/after: %d → %d                              ║\n" "$B_HOOKS" "$A_HOOKS"
echo "╚══════════════════════════════════════════════════════════╝"

# ── Per-category breakdown ────────────────────────────────────────────────────
node -e "
  const before = JSON.parse('$B_BY_CAT');
  const after  = JSON.parse('$A_BY_CAT');
  const cats   = new Set([...Object.keys(before), ...Object.keys(after)]);
  if (cats.size === 0) { console.log('  (no category data)'); process.exit(0); }
  console.log('');
  console.log('  Category breakdown:');
  console.log('  ' + '─'.repeat(56));
  console.log('  ' + 'Category'.padEnd(26) + 'Before'.padStart(8) + '  After'.padStart(8) + '  Delta'.padStart(8));
  console.log('  ' + '─'.repeat(56));
  const sorted = [...cats].sort((a,b) => (after[b]??0) - (after[a]??0));
  for (const cat of sorted) {
    const b = before[cat] ?? 0;
    const a = after[cat]  ?? 0;
    const d = a - b;
    const sign = d < 0 ? '' : d > 0 ? '+' : ' ';
    console.log('  ' + cat.padEnd(26) + String(b).padStart(8) + '  ' + String(a).padStart(6) + '  ' + (sign+d).padStart(7));
  }
  console.log('  ' + '─'.repeat(56));
" 2>/dev/null || true

echo ""

# ── Exit code ─────────────────────────────────────────────────────────────────
if [[ "$DELTA" -gt 0 ]]; then
  echo "REGRESSION: token overhead increased by $DELTA tokens (+${PCT}%)" >&2
  exit 1
fi
exit 0
