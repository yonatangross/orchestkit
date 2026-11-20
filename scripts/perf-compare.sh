#!/usr/bin/env bash
# perf-compare.sh — before/after perf-snapshot comparison (#946)
#
# Usage:
#   ./scripts/perf-compare.sh before.json after.json
#
# Exit codes:
#   0 — no regression (after ≤ before total tokens)
#   1 — regression detected (after > before total tokens)
#   2 — usage error / file not found / snapshot not readable

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <before.json> <after.json>" >&2
  exit 2
fi

BEFORE="$1"
AFTER="$2"

if [[ ! -f "$BEFORE" ]]; then echo "Error: before file not found: $BEFORE" >&2; exit 2; fi
if [[ ! -f "$AFTER"  ]]; then echo "Error: after file not found: $AFTER"   >&2; exit 2; fi

# ── Safe extraction via node with file path argument (no shell injection) ──────
# node -e receives no user data inline; file paths are passed via process.argv
# A snapshot that cannot be read is an input error, never a zero-token snapshot.
read_scalars() {
  node -e "
    const file = process.argv[1];
    let d;
    try {
      d = JSON.parse(require('fs').readFileSync(file, 'utf8'));
    } catch (err) {
      console.error('Error: snapshot is not valid JSON: ' + file + ' (' + err.message + ')');
      process.exit(2);
    }
    if (d === null || typeof d !== 'object' || Array.isArray(d)) {
      console.error('Error: snapshot is not a JSON object: ' + file);
      process.exit(2);
    }
    for (const key of ['totalTokensInjected', 'hookCount']) {
      if (d[key] !== undefined && !(Number.isSafeInteger(d[key]) && d[key] >= 0)) {
        console.error('Error: snapshot ' + key + ' is not a non-negative integer: ' + file);
        process.exit(2);
      }
    }
    process.stdout.write([
      d.totalTokensInjected ?? 0,
      d.hookCount ?? 0,
      d.bucket ?? 'unknown'
    ].join('|'));
  " -- "$1"
}

# Write per-category report using file paths — no inline JSON interpolation
print_category_breakdown() {
  node -e "
    const before = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).byCategory ?? {};
    const after  = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8')).byCategory ?? {};
    const cats = new Set([...Object.keys(before), ...Object.keys(after)]);
    if (cats.size === 0) { console.log('  (no category data)'); return; }
    console.log('');
    console.log('  Category breakdown:');
    console.log('  ' + '-'.repeat(56));
    console.log('  ' + 'Category'.padEnd(26) + 'Before'.padStart(8) + '  After'.padStart(8) + '  Delta'.padStart(8));
    console.log('  ' + '-'.repeat(56));
    const sorted = [...cats].sort((a, b) => (after[b] ?? 0) - (after[a] ?? 0));
    for (const cat of sorted) {
      const b = before[cat] ?? 0;
      const a = after[cat] ?? 0;
      const d = a - b;
      const sign = d < 0 ? '' : d > 0 ? '+' : ' ';
      console.log('  ' + cat.padEnd(26) + String(b).padStart(8) + '  ' + String(a).padStart(6) + '  ' + (sign + d).padStart(7));
    }
    console.log('  ' + '-'.repeat(56));
  " -- "$BEFORE" "$AFTER" 2>/dev/null || true
}

B_SCALARS="$(read_scalars "$BEFORE")" || exit 2
A_SCALARS="$(read_scalars "$AFTER")" || exit 2
IFS='|' read -r B_TOKENS B_HOOKS B_BUCKET <<< "$B_SCALARS"
IFS='|' read -r A_TOKENS A_HOOKS A_BUCKET <<< "$A_SCALARS"

DELTA=$(( A_TOKENS - B_TOKENS ))
PCT=0
if [[ "$B_TOKENS" -gt 0 ]]; then
  PCT=$(( DELTA * 100 / B_TOKENS ))
fi

# ── Summary header ─────────────────────────────────────────────────────────────
echo ""
echo "=== OrchestKit Perf Snapshot Comparison ==="
printf "  Before: %s  (%s)\n" "$B_BUCKET" "$BEFORE"
printf "  After:  %s  (%s)\n" "$A_BUCKET" "$AFTER"
echo ""
printf "  Total before:  %7d tokens\n" "$B_TOKENS"
printf "  Total after:   %7d tokens\n" "$A_TOKENS"

if [[ "$DELTA" -lt 0 ]]; then
  printf "  Delta:         %7d tokens  (%+d%%)  IMPROVEMENT\n" "$DELTA" "$PCT"
elif [[ "$DELTA" -gt 0 ]]; then
  printf "  Delta:         %+7d tokens  (%+d%%)  REGRESSION\n" "$DELTA" "$PCT"
else
  printf "  Delta:               0 tokens  (0%%)   NO CHANGE\n"
fi

printf "  Hooks before/after:  %d -> %d\n" "$B_HOOKS" "$A_HOOKS"

print_category_breakdown

echo ""

# ── Exit code ─────────────────────────────────────────────────────────────────
if [[ "$DELTA" -gt 0 ]]; then
  echo "REGRESSION: token overhead increased by $DELTA tokens (+${PCT}%)" >&2
  exit 1
fi
exit 0
