#!/usr/bin/env bash
# npm audit gate — blocks on moderate+ CVEs across the four package.json
# files in the repo. Part of the security-tests suite because a CVE in
# a dev dependency is still shipping code we would not want to ignore.
#
# Scope:
#   - package.json                 (root)
#   - docs/site/package.json       (Next.js docs site)
#   - src/hooks/package.json       (TypeScript hooks bundle)
#   - src/mcp-server/package.json  (@orchestkit/mcp-server, npm package)
#
# Severity threshold: moderate (default). Override with NPM_AUDIT_LEVEL=low
# for stricter runs, or high to relax.
#
# Allowlist: .claude/audit-allowlist.json holds advisory IDs we have
# consciously accepted. Format:
#   { "<advisory-id>": { "reason": "...", "until": "YYYY-MM-DD" } }
# An expired "until" date fails the test even for allowlisted IDs, so
# exceptions are forced to be revisited.
#
# Part of Road to 10 — Wave 3 (Lever 3: Security).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LEVEL="${NPM_AUDIT_LEVEL:-moderate}"
ALLOWLIST="$PROJECT_ROOT/.claude/audit-allowlist.json"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
NC=$'\033[0m'

PASS=0
FAIL=0

pass() { echo "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  ${YELLOW}⚠${NC} $1"; }

echo "════════════════════════════════════════════════════════════════"
echo "  npm audit gate (severity ≥ ${LEVEL})"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Build allowlist lookup (advisory-id → status) with date-aware expiry
ACTIVE_IDS=()
if [[ -f "$ALLOWLIST" ]]; then
  TODAY=$(date -u +%Y-%m-%d)
  # jq: emit ids whose "until" date is in the future OR missing
  while read -r id; do
    [[ -n "$id" ]] && ACTIVE_IDS+=("$id")
  done < <(jq -r --arg today "$TODAY" '
    to_entries[] | select(.value.until == null or .value.until > $today) | .key
  ' "$ALLOWLIST" 2>/dev/null)

  # Warn on expired entries (so they get revisited)
  while read -r id; do
    [[ -n "$id" ]] && warn "audit allowlist entry $id has expired — remove or extend"
  done < <(jq -r --arg today "$TODAY" '
    to_entries[] | select(.value.until != null and .value.until <= $today) | .key
  ' "$ALLOWLIST" 2>/dev/null)
fi

is_allowlisted() {
  local target="$1"
  for id in "${ACTIVE_IDS[@]}"; do
    [[ "$id" == "$target" ]] && return 0
  done
  return 1
}

audit_project() {
  local label="$1"
  local dir="$2"

  if [[ ! -f "$dir/package.json" ]]; then
    warn "$label: no package.json, skipping"
    return 0
  fi
  if [[ ! -d "$dir/node_modules" ]]; then
    warn "$label: node_modules not installed, skipping (run npm install first)"
    return 0
  fi

  echo "▶ $label ($dir)"

  local report
  report=$(cd "$dir" && npm audit --audit-level="$LEVEL" --json 2>/dev/null || true)

  # npm audit returns exit 1 when findings exist — which is expected.
  # We parse the JSON regardless and decide per-advisory.
  if [[ -z "$report" ]]; then
    fail "$label: npm audit produced no output"
    echo ""
    return 1
  fi

  local total
  total=$(echo "$report" | jq -r '.metadata.vulnerabilities | to_entries | map(select(.key == "moderate" or .key == "high" or .key == "critical")) | map(.value) | add // 0' 2>/dev/null || echo "0")

  if [[ "$total" -eq 0 ]]; then
    pass "$label: 0 findings ≥ $LEVEL"
    echo ""
    return 0
  fi

  # Walk each advisory. Fail only on those not in the allowlist.
  local unlisted=0
  while read -r advisory; do
    [[ -z "$advisory" ]] && continue
    local id sev title
    id=$(echo "$advisory" | jq -r '.id // .source // "unknown"')
    sev=$(echo "$advisory" | jq -r '.severity // "?"')
    title=$(echo "$advisory" | jq -r '.title // "(no title)"')
    if is_allowlisted "$id"; then
      warn "$label: $id [$sev] $title — allowlisted"
    else
      fail "$label: $id [$sev] $title — NOT in allowlist"
      unlisted=$((unlisted + 1))
    fi
  done < <(echo "$report" | jq -c '.vulnerabilities // {} | to_entries[] | .value.via[]? | select(type=="object")' 2>/dev/null)

  if [[ "$unlisted" -eq 0 ]]; then
    pass "$label: $total finding(s), all allowlisted"
  fi
  echo ""
}

# ─── run across the four package.json paths ─────────────────────────
audit_project "root"           "$PROJECT_ROOT"
audit_project "docs/site"      "$PROJECT_ROOT/docs/site"
audit_project "src/hooks"      "$PROJECT_ROOT/src/hooks"
audit_project "src/mcp-server" "$PROJECT_ROOT/src/mcp-server"

# ─── summary ───────────────────────────────────────────────────────
echo "════════════════════════════════════════════════════════════════"
echo "  Total: $((PASS + FAIL))  |  Passed: ${GREEN}${PASS}${NC}  |  Failed: ${RED}${FAIL}${NC}"
echo "════════════════════════════════════════════════════════════════"

[[ $FAIL -eq 0 ]] || exit 1
exit 0
