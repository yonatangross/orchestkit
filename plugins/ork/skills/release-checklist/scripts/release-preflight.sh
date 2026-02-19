#!/usr/bin/env bash
# release-preflight.sh — Runs release gates 1-5 (automated checks).
# Run from project root. Stops on first failure.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$PROJECT_ROOT"

PASS='\033[0;32m[PASS]\033[0m'
FAIL='\033[0;31m[FAIL]\033[0m'

echo "========================================"
echo "  OrchestKit Release Preflight"
echo "========================================"
echo ""

echo -n "Step 1: Build ... "
if npm run build --silent 2>/dev/null; then
    echo -e "$PASS"
else
    echo -e "$FAIL — fix src/ errors and re-run"
    exit 1
fi

echo -n "Step 2: Tests ... "
if npm test --silent 2>/dev/null; then
    echo -e "$PASS"
else
    echo -e "$FAIL — fix failing tests before proceeding"
    exit 1
fi

echo -n "Step 3: Security tests ... "
if npm run test:security --silent 2>/dev/null; then
    echo -e "$PASS"
else
    echo -e "$FAIL — MUST fix security issues first"
    exit 1
fi

echo -n "Step 4: TypeScript ... "
if npm run typecheck --silent 2>/dev/null; then
    echo -e "$PASS"
else
    echo -e "$FAIL — fix type errors in src/hooks/src/"
    exit 1
fi

echo ""
echo "All automated gates passed. Proceed with Steps 6–12 manually."
