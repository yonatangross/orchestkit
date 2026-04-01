#!/bin/bash
# Security Tests: Packaging Leak Prevention
# Ensures no sensitive files land in plugins/ (the shipping directory).
#
# Inspired by the Claude Code source map leak incident.
# Uses `git ls-files` to scan only tracked files (what would actually ship),
# avoiding false positives from OS artifacts like .DS_Store.
#
# Scans plugins/ for:
#   - Secret/credential files (.env, .secrets, .key, .pem, .p12, .credentials)
#   - OS artifacts (.DS_Store, Thumbs.db) that were accidentally git-added
#   - Stray source maps outside hooks/dist/ and mcp-server/
#   - Unexpected file extensions not in the allowlist
#
# Test Count: 4
# Priority: HIGH
# Reference: GitHub Issue #1237

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLUGINS_DIR="$PROJECT_ROOT/plugins"
PLUGINS_REL="plugins"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

log_pass() { echo -e "  ${GREEN}✓${NC} $1"; TESTS_PASSED=$((TESTS_PASSED + 1)); }
log_fail() { echo -e "  ${RED}✗${NC} $1"; TESTS_FAILED=$((TESTS_FAILED + 1)); }
log_section() { echo -e "\n${YELLOW}$1${NC}"; }

# ============================================================================
# PACKAGING LEAK PREVENTION TESTS
# ============================================================================

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║    Packaging Leak Prevention Tests (Issue #1237)                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"

# Verify plugins/ exists
if [[ ! -d "$PLUGINS_DIR" ]]; then
    echo -e "${RED}FAIL: plugins/ directory not found — run 'npm run build' first${NC}"
    exit 1
fi

# Collect all tracked files in plugins/ once.
# Uses git ls-files (what would ship) with fallback to find (pre-commit).
TRACKED_LIST=$(cd "$PROJECT_ROOT" && git ls-files --cached -- "$PLUGINS_REL/" 2>/dev/null || true)

if [[ -z "$TRACKED_LIST" ]]; then
    echo -e "${YELLOW}WARN: No tracked files in plugins/ — falling back to filesystem scan${NC}"
    TRACKED_LIST=$(cd "$PROJECT_ROOT" && find "$PLUGINS_REL" -type f 2>/dev/null)
fi

FILE_COUNT=$(echo "$TRACKED_LIST" | wc -l | tr -d ' ')
echo "  Scanning $FILE_COUNT tracked files in plugins/"

# --------------------------------------------------------------------------
# Test 1: No secret/credential files
# --------------------------------------------------------------------------
log_section "Test 1: No secret or credential files in plugins/"

DANGEROUS=$(echo "$TRACKED_LIST" | grep -iE '\.(env|secrets?|key|pem|p12|pfx|p8|credentials|keystore|jks|gpg|asc)$' || true)
# Also catch .env files (exact name or .env.*)
DANGEROUS_ENV=$(echo "$TRACKED_LIST" | grep -E '/(\.env|\.env\..*)$' || true)
DANGEROUS_ALL=$(printf '%s\n%s' "$DANGEROUS" "$DANGEROUS_ENV" | sort -u | sed '/^$/d')

if [[ -z "$DANGEROUS_ALL" ]]; then
    log_pass "No secret/credential files found"
else
    COUNT=$(echo "$DANGEROUS_ALL" | wc -l | tr -d ' ')
    log_fail "Found $COUNT secret/credential file(s):"
    echo "$DANGEROUS_ALL" | while IFS= read -r f; do
        echo -e "    ${RED}→${NC} $f"
    done
fi

# --------------------------------------------------------------------------
# Test 2: No OS artifacts or editor temp files
# --------------------------------------------------------------------------
log_section "Test 2: No OS artifacts or editor temp files in plugins/"

ARTIFACTS=$(echo "$TRACKED_LIST" | grep -E '/(\.DS_Store|Thumbs\.db|desktop\.ini)$' || true)
EDITOR_TEMP=$(echo "$TRACKED_LIST" | grep -E '\.(swp|swo)$|~$' || true)
IDE_DIRS=$(echo "$TRACKED_LIST" | grep -E '/(\.idea|\.vscode|\.vs|__pycache__|node_modules)/' || true)
ARTIFACTS_ALL=$(printf '%s\n%s\n%s' "$ARTIFACTS" "$EDITOR_TEMP" "$IDE_DIRS" | sort -u | sed '/^$/d')

if [[ -z "$ARTIFACTS_ALL" ]]; then
    log_pass "No OS artifacts or editor temp files found"
else
    COUNT=$(echo "$ARTIFACTS_ALL" | wc -l | tr -d ' ')
    log_fail "Found $COUNT OS artifact(s) or editor temp file(s):"
    echo "$ARTIFACTS_ALL" | while IFS= read -r f; do
        echo -e "    ${RED}→${NC} $f"
    done
fi

# --------------------------------------------------------------------------
# Test 3: No source map files outside hooks/dist/ and mcp-server/
# --------------------------------------------------------------------------
log_section "Test 3: No stray source maps outside hooks/dist/ and mcp-server/"

# .map files in hooks/dist/ and mcp-server/ are expected (esbuild sourcemap: true)
ALL_MAPS=$(echo "$TRACKED_LIST" | grep -E '\.(map|sourcemap|source-map)$' || true)
STRAY_MAPS=$(echo "$ALL_MAPS" | grep -v -E '/hooks/dist/.*\.map$' | grep -v -E '/mcp-server/.*\.map$' | sed '/^$/d' || true)

if [[ -z "$STRAY_MAPS" ]]; then
    log_pass "No stray source maps found outside allowed directories"
else
    COUNT=$(echo "$STRAY_MAPS" | wc -l | tr -d ' ')
    log_fail "Found $COUNT stray source map(s):"
    echo "$STRAY_MAPS" | while IFS= read -r f; do
        echo -e "    ${RED}→${NC} $f"
    done
fi

# --------------------------------------------------------------------------
# Test 4: Only expected file extensions in plugins/
# --------------------------------------------------------------------------
log_section "Test 4: Only allowlisted file extensions in plugins/"

# Allowlist of file extensions expected in plugins/.
# Add new extensions here with a comment explaining why.
ALLOWED_REGEX='\.(md|json|mjs|js|ts|tsx|py|sh|yaml|yml|html|css|tf|map)$'

# Filter to files with extensions (skip extensionless like Dockerfile)
FILES_WITH_EXT=$(echo "$TRACKED_LIST" | grep -E '\.[^/]+$' || true)
UNEXPECTED=$(echo "$FILES_WITH_EXT" | grep -v -E "$ALLOWED_REGEX" | sed '/^$/d' || true)

if [[ -z "$UNEXPECTED" ]]; then
    log_pass "All files have allowlisted extensions"
else
    COUNT=$(echo "$UNEXPECTED" | wc -l | tr -d ' ')
    log_fail "Found $COUNT file(s) with unexpected extensions:"
    echo "$UNEXPECTED" | while IFS= read -r f; do
        ext="${f##*.}"
        echo -e "    ${RED}→${NC} $f (.$ext)"
    done
    echo ""
    echo -e "  ${YELLOW}If this extension is legitimate, add it to ALLOWED_REGEX in${NC}"
    echo -e "  ${YELLOW}tests/security/test-packaging-leaks.sh${NC}"
fi

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "=========================================="
echo "  Results: $TESTS_PASSED passed, $TESTS_FAILED failed"
echo "=========================================="

if [[ $TESTS_FAILED -gt 0 ]]; then
    echo -e "${RED}FAIL: Packaging leak(s) detected — fix before shipping${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: No packaging leaks detected${NC}"
    exit 0
fi
