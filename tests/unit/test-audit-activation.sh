#!/usr/bin/env bash
# Focused deterministic collector tests for audit-activation (#3922).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SOURCE_SCRIPT="$REPO_ROOT/src/skills/audit-activation/scripts/run-activation-audit.sh"
SOURCE_COLLECTOR="$REPO_ROOT/src/skills/audit-activation/scripts/collect-activation-audit.mjs"

PASS=0; FAIL=0
pass() { printf 'ok - %s\n' "$1"; PASS=$((PASS + 1)); }
fail() { printf 'not ok - %s\n' "$1"; FAIL=$((FAIL + 1)); }
assert_json() {
  local label="$1" json="$2" expression="$3"
  if printf '%s' "$json" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);process.exit(($expression)?0:1)})"; then
    pass "$label"
  else
    fail "$label"
  fi
}

SBX="$(mktemp -d "${TMPDIR:-/tmp}/ork-activation.XXXXXX")"
trap 'rm -rf "$SBX"' EXIT
for layout in source package; do
  if [ "$layout" = source ]; then
    base="$SBX/source"
    skill_dir="$base/src/skills/audit-activation/scripts"
    agents_dir="$base/src/agents"
  else
    base="$SBX/package"
    skill_dir="$base/plugins/ork/skills/audit-activation/scripts"
    agents_dir="$base/plugins/ork/agents"
  fi
  mkdir -p "$skill_dir" "$agents_dir"
  cp "$SOURCE_SCRIPT" "$skill_dir/run-activation-audit.sh"
  cp "$SOURCE_COLLECTOR" "$skill_dir/collect-activation-audit.mjs"
  for agent in alpha-agent beta-agent gamma-agent; do printf 'name: %s\n' "$agent" > "$agents_dir/$agent.md"; done
  printf 'README\n' > "$agents_dir/README.md"
  mkdir -p "$(dirname "$agents_dir")/skills/demo"
  printf 'subagent_type="ork:alpha-agent"\n' > "$(dirname "$agents_dir")/skills/demo/SKILL.md"
done

END='2026-09-05T00:00:00Z'
CONSUMER_A="$SBX/consumer-a"
STOP_A="$SBX/stops-a.jsonl"
mkdir -p "$CONSUMER_A/.claude/logs"
cat > "$CONSUMER_A/.claude/logs/subagent-spawns.jsonl" <<'EOF'
{"timestamp":"2026-08-20T00:00:00Z","session_id":"source","source":"pretool","subagent_type":"ork:alpha-agent","agent_name":"reviewer"}
{"timestamp":"2026-08-20T00:00:01Z","session_id":"source","source":"start","subagent_type":"reviewer"}
{"timestamp":"2026-08-20T00:00:02Z","session_id":"source","source":"start","subagent_type":"Explore"}
{"timestamp":"2026-08-01T00:00:00Z","session_id":"source","source":"start","subagent_type":"ork:gamma-agent"}
{"timestamp":"2026-08-20T00:00:03Z","session_id":"test-generic","source":"start","subagent_type":"Explore"}
EOF
cat > "$STOP_A" <<'EOF'
{"ts":"2026-08-20T00:05:00Z","agent":"ork:alpha-agent"}
{"ts":"2026-08-20T00:05:01Z","agent":"unknown-plugin:worker"}
{"ts":"2026-08-20T00:05:02Z","agent":"ork:beta-agent","phantom":true}
EOF
ln -s "$STOP_A" "$SBX/stops-a-alias.jsonl"

SOURCE_RUN="$SBX/source/src/skills/audit-activation/scripts/run-activation-audit.sh"
json="$($SOURCE_RUN --json --telemetry-root "$CONSUMER_A" --stop-feed "$STOP_A" --stop-feed "$SBX/stops-a-alias.jsonl" --days 30 --end "$END")"
assert_json 'source layout uses src/agents and keeps attempted, started, and completed separate' "$json" 'r.schema_version===1 && r.catalog.root.endsWith("/source/src/agents") && r.totals.attempted===1 && r.totals.started===2 && r.totals.ork===1 && r.totals.completed===2 && r.totals.catalog_completed===1 && r.totals.unattributed_completed===1 && r.totals.phantom_completed_excluded===1 && r.agents.find(a=>a.name==="alpha-agent").attempted===1 && r.agents.find(a=>a.name==="alpha-agent").started===1 && r.agents.find(a=>a.name==="alpha-agent").fires===1 && r.coverage.stop.files.length===1'
assert_json 'older rows are excluded from explicit 30-day replay window' "$json" 'r.window.days===30 && r.window.end==="2026-09-05T00:00:00.000Z" && r.coverage.spawn.outside_window_rows===1 && r.agents.find(a=>a.name==="gamma-agent").fires===0'
assert_json 'source coverage labels observed zero starts without an estate-wide dormant claim' "$json" 'r.coverage.spawn.state==="observed" && r.coverage.spawn.estate_complete===false && r.observed_zero_starts.available===true && r.observed_zero_starts.names.includes("beta-agent")'
assert_json 'generic-only test sessions are excluded even without a catalog agent' "$json" 'r.excluded.sessions.includes("test-generic") && r.totals.generic===1'

PACKAGE_RUN="$SBX/package/plugins/ork/skills/audit-activation/scripts/run-activation-audit.sh"
CONSUMER_B="$SBX/consumer-b"
mkdir -p "$CONSUMER_B/.claude/logs"
cat > "$CONSUMER_B/.claude/logs/subagent-spawns.jsonl" <<'EOF'
{"timestamp":"2026-08-21T00:00:00Z","session_id":"session-A","source":"pretool","subagent_type":"ork:alpha-agent","agent_name":"reviewer"}
{"timestamp":"2026-08-21T00:00:01Z","session_id":"session-A","source":"start","subagent_type":"reviewer"}
{"timestamp":"2026-08-22T00:00:00Z","session_id":"session-B","source":"pretool","subagent_type":"ork:beta-agent","agent_name":"reviewer"}
{"timestamp":"2026-08-22T00:00:01Z","session_id":"session-B","source":"start","subagent_type":"reviewer"}
EOF
json="$($PACKAGE_RUN --json --telemetry-root "$CONSUMER_B" --days 30 --end "$END")"
assert_json 'packaged layout uses agents beside the installed skills directory' "$json" 'r.catalog.root.endsWith("/package/plugins/ork/agents") && r.catalog.agents===3'
assert_json 'custom names resolve by session and count each start once' "$json" 'r.totals.attempted===2 && r.totals.started===2 && r.resolved_named_starts===2 && r.agents.find(a=>a.name==="alpha-agent").fires===1 && r.agents.find(a=>a.name==="beta-agent").fires===1'

CONSUMER_REUSE="$SBX/consumer-reuse"
mkdir -p "$CONSUMER_REUSE/.claude/logs"
cat > "$CONSUMER_REUSE/.claude/logs/subagent-spawns.jsonl" <<'EOF'
{"timestamp":"2026-08-24T00:00:00Z","session_id":"reuse","source":"pretool","subagent_type":"ork:alpha-agent","agent_name":"reviewer"}
{"timestamp":"2026-08-24T00:00:01Z","session_id":"reuse","source":"start","subagent_type":"reviewer"}
{"timestamp":"2026-08-24T00:00:02Z","session_id":"reuse","source":"pretool","subagent_type":"ork:beta-agent","agent_name":"reviewer"}
{"timestamp":"2026-08-24T00:00:03Z","session_id":"reuse","source":"start","subagent_type":"reviewer"}
EOF
json="$($PACKAGE_RUN --json --telemetry-root "$CONSUMER_REUSE" --days 30 --end "$END")"
assert_json 'reused same-session custom names keep ordered evidence and mark later conflict ambiguous' "$json" 'r.totals.started===2 && r.resolved_named_starts===1 && r.ambiguous_named_starts===1 && r.agents.find(a=>a.name==="alpha-agent").started===1 && r.agents.find(a=>a.name==="beta-agent").started===0'

CONSUMER_NAMESPACE="$SBX/consumer-namespace"
mkdir -p "$CONSUMER_NAMESPACE/.claude/logs"
printf '%s\n' '{"timestamp":"2026-08-23T00:00:00Z","session_id":"hq","source":"start","subagent_type":"hq-ext:alpha-agent"}' > "$CONSUMER_NAMESPACE/.claude/logs/subagent-spawns.jsonl"
printf 'subagent_type="hq-ext:alpha-agent"\n' > "$SBX/package/plugins/ork/skills/demo/SKILL.md"
printf '%s\n' '{"timestamp":"2026-08-23T00:00:01Z","session_id":"hq","source":"start","subagent_type":"other:hq-ext:alpha-agent"}' >> "$CONSUMER_NAMESPACE/.claude/logs/subagent-spawns.jsonl"
json="$($PACKAGE_RUN --json --namespace hq-ext --telemetry-root "$CONSUMER_NAMESPACE" --days 30 --end "$END")"
assert_json 'configured namespace uses a literal prefix and does not strip it from the middle of another type' "$json" 'r.catalog.namespace==="hq-ext" && r.totals.catalog===1 && r.totals.other===1 && r.agents.find(a=>a.name==="alpha-agent").started===1 && r.agents.find(a=>a.name==="alpha-agent").skillRefs===1'

ln -s "$CONSUMER_B" "$SBX/consumer-b-alias"
json="$($PACKAGE_RUN --json --telemetry-root "$CONSUMER_B" --telemetry-root "$SBX/consumer-b-alias" --days 30 --end "$END")"
assert_json 'canonical telemetry roots deduplicate symlink aliases before counting' "$json" 'r.coverage.spawn.files.length===1 && r.totals.attempted===2 && r.totals.started===2'

json="$($PACKAGE_RUN --json --days 30 --end "$END")"
assert_json 'missing telemetry does not fabricate a denominator or dormant verdict' "$json" 'r.totals.started===0 && r.unique_spawns===null && r.coverage.spawn.state==="missing" && r.coverage.spawn.files.length===0 && r.observed_zero_starts.available===false && r.observed_zero_starts.names.length===0'

CONSUMER_C="$SBX/consumer-c"
mkdir -p "$CONSUMER_C/.claude/logs"
printf 'not-json\n' > "$CONSUMER_C/.claude/logs/subagent-spawns.jsonl"
json="$($PACKAGE_RUN --json --telemetry-root "$CONSUMER_C" --days 30 --end "$END")"
assert_json 'malformed telemetry is reported as partial and prevents an observed-zero result' "$json" 'r.coverage.spawn.malformed_rows===1 && r.coverage.spawn.state==="partial" && r.observed_zero_starts.available===false'

CONSUMER_D="$SBX/consumer-d"
mkdir -p "$CONSUMER_D/.claude/logs"
: > "$CONSUMER_D/.claude/logs/subagent-spawns.jsonl"
json="$($PACKAGE_RUN --json --telemetry-root "$CONSUMER_D" --days 30 --end "$END")"
assert_json 'empty telemetry is reported separately from missing and partial inputs' "$json" 'r.coverage.spawn.state==="empty" && r.coverage.spawn.empty.length===1 && r.observed_zero_starts.available===false'

printf '1..%s\n' "$((PASS + FAIL))"
printf '# passed %s failed %s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
