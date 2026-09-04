#!/usr/bin/env bash
# Regression coverage for the release-announce credential preflight (#3650).
#
# A provisioned GitHub secret can be non-empty yet revoked. The preflight must
# make an authenticated, non-persisting request before the live announce so a
# rotation is actionable instead of surfacing as the release rail's final 401.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
ANNOUNCE="$PROJECT_ROOT/scripts/announce-release.mjs"
WORKFLOW="$PROJECT_ROOT/.github/workflows/release-announce.yml"
README="$PROJECT_ROOT/.github/workflows/README.md"
TOKEN_REFERENCE="op://Platform/API-Static-Token/credential"
FIXTURE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ork-announce.XXXXXX")"
trap 'rm -rf "$FIXTURE_DIR"' EXIT

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; NC=$'\033[0m'
PASS=0; FAIL=0
pass() { echo "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }

PRELOAD="$FIXTURE_DIR/fetch-preload.mjs"
CAPTURE="$FIXTURE_DIR/fetch.json"
cat > "$PRELOAD" <<'EOF'
import { writeFileSync } from "node:fs";

globalThis.fetch = async (url, options) => {
  writeFileSync(process.env.ANNOUNCE_FETCH_CAPTURE, JSON.stringify({
    url,
    options,
    hasAbortSignal: typeof options.signal?.addEventListener === "function",
  }));
  if (process.env.ANNOUNCE_FETCH_MODE === "abort") {
    throw new DOMException("request timed out", "TimeoutError");
  }
  const status = Number(process.env.ANNOUNCE_FETCH_STATUS || "200");
  return new Response(JSON.stringify({ dry_run: true, detail: "invalid token" }), {
    status,
    headers: { "content-type": "application/json" },
  });
};
EOF

echo "=========================================="
echo "  release announce credential preflight"
echo "=========================================="

# The request must use the real announce endpoint, bearer, and a platform
# dry-run. The fetch preload is a local boundary double, so this never reaches
# the network or touches the platform queue.
OUT="$FIXTURE_DIR/preflight.out"
ERR="$FIXTURE_DIR/preflight.err"
if ANNOUNCE_FETCH_CAPTURE="$CAPTURE" RELEASE_VERSION="10.0.0-alpha.45" \
  RELEASE_URL="https://example.invalid/releases/v10.0.0-alpha.45" \
  HQ_API_URL="https://platform.example.invalid/" HQ_API_TOKEN="replacement-token" \
  PREFLIGHT=true node --import "$PRELOAD" "$ANNOUNCE" >"$OUT" 2>"$ERR"; then
  pass "preflight exits successfully for an authenticated dry-run"
else
  fail "preflight unexpectedly failed: $(<"$ERR")"
fi

if node -e '
const fs = require("fs");
const call = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const payload = JSON.parse(call.options.body);
if (call.url !== "https://platform.example.invalid/api/marketing/release-announce") process.exit(1);
if (call.options.headers.authorization !== "Bearer replacement-token") process.exit(1);
if (payload.dry_run !== true) process.exit(1);
if (call.hasAbortSignal !== true) process.exit(1);
' "$CAPTURE"; then
  pass "preflight authenticates the announce endpoint with a non-persisting payload"
else
  fail "preflight request did not preserve endpoint, bearer, dry_run=true, and a timeout signal"
fi

ABORTED_ERR="$FIXTURE_DIR/aborted-preflight.err"
if ANNOUNCE_FETCH_CAPTURE="$CAPTURE" ANNOUNCE_FETCH_MODE=abort \
  RELEASE_VERSION="10.0.0-alpha.45" RELEASE_URL="https://example.invalid/r" \
  HQ_API_URL="https://platform.example.invalid" HQ_API_TOKEN="replacement-token" \
  PREFLIGHT=true node --import "$PRELOAD" "$ANNOUNCE" > /dev/null 2>"$ABORTED_ERR"; then
  fail "preflight continued after an aborted platform request"
elif [[ "$(<"$ABORTED_ERR")" == *"credential preflight failed within 10000ms"* ]]; then
  pass "aborted preflight stops before a live announce can continue"
else
  fail "aborted preflight error was not specific: $(<"$ABORTED_ERR")"
fi

REJECTED_ERR="$FIXTURE_DIR/rejected-token.err"
if ANNOUNCE_FETCH_CAPTURE="$CAPTURE" ANNOUNCE_FETCH_STATUS=401 \
  RELEASE_VERSION="10.0.0-alpha.45" RELEASE_URL="https://example.invalid/r" \
  HQ_API_URL="https://platform.example.invalid" HQ_API_TOKEN="retired-token" \
  PREFLIGHT=true node --import "$PRELOAD" "$ANNOUNCE" > /dev/null 2>"$REJECTED_ERR"; then
  fail "preflight accepted a rejected HQ_API_TOKEN"
elif [[ "$(<"$REJECTED_ERR")" == *"$TOKEN_REFERENCE"* ]]; then
  pass "rejected token fails loudly with the exact rotation reference"
else
  fail "rejected token error omitted the rotation reference: $(<"$REJECTED_ERR")"
fi

MISSING_ERR="$FIXTURE_DIR/missing-token.err"
if RELEASE_VERSION="10.0.0-alpha.45" RELEASE_URL="https://example.invalid/r" \
  HQ_API_URL="https://platform.example.invalid" PREFLIGHT=true node "$ANNOUNCE" \
  > /dev/null 2>"$MISSING_ERR"; then
  fail "preflight accepted a missing HQ_API_TOKEN"
elif [[ "$(<"$MISSING_ERR")" == *"$TOKEN_REFERENCE"* ]]; then
  pass "missing token fails loudly with the exact rotation reference"
else
  fail "missing token error omitted the rotation reference: $(<"$MISSING_ERR")"
fi

if grep -Fq 'credential_preflight' "$WORKFLOW" && \
  grep -Fq 'PREFLIGHT: "true"' "$WORKFLOW" && \
  grep -Fq 'github.event.inputs.dry_run != '\''true'\''' "$WORKFLOW"; then
  pass "workflow runs the preflight only before live announces"
else
  fail "workflow does not correctly wire the credential preflight"
fi

if grep -Fq "$TOKEN_REFERENCE" "$README" && \
  grep -Fq 'gh secret set HQ_API_TOKEN --repo yonatangross/orchestkit' "$README" && \
  grep -Fq 'op-read.sh --cache 3600' "$README" && \
  grep -Fq 'op_read_status=$?' "$README" && \
  grep -Fq '[[ -z "$HQ_API_TOKEN" ]]' "$README" && \
  grep -Fq 'printf '\''%s'\'' "$HQ_API_TOKEN" |' "$README"; then
  pass "rail README documents the chokepoint rotation procedure"
else
  fail "rail README is missing the token rotation procedure"
fi

echo "=========================================="
echo "  Results: ${PASS} passed, ${FAIL} failed"
echo "=========================================="

[[ "$FAIL" -eq 0 ]]
