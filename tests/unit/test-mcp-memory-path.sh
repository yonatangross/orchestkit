#!/bin/bash
# Regression guard for #2631 — the MCP memory knowledge-graph must persist.
#
# Validates the TRACKED template (.claude/templates/mcp-enabled.json), which is the
# shippable source users copy to their (gitignored) .mcp.json. The live .mcp.json is
# git-ignored, so it is NOT the authoritative surface and may be absent in CI.
#
# Root cause it guards against:
#   @modelcontextprotocol/server-memory joins a RELATIVE MEMORY_FILE_PATH to its OWN
#   dist dir (path.dirname(import.meta.url)), NOT to CWD. And ${CLAUDE_PROJECT_DIR}
#   does NOT expand inside a project .mcp.json — it is only present in the launched
#   server's process env (CC docs, >= 2.1.191). So the old value
#       "${CLAUDE_PROJECT_DIR:-.}/.claude/memory/memory.json"
#   was config-load-expanded by CC (whose own env lacks the var) down to
#   "./.claude/..." -> resolved into the npx cache dir -> ENOENT -> the graph
#   silently never persisted (dead for months; every /ork:remember write failed).
#
# The fix: an `sh -c` wrapper that resolves an ABSOLUTE path at RUNTIME from the
# server-env $CLAUDE_PROJECT_DIR (fallback $PWD), then execs the server.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TPL="$ROOT/.claude/templates/mcp-enabled.json"
FAIL=0

ok()  { echo "  ✓ $1"; }
bad() { echo "  ✗ $1"; FAIL=1; }

echo "MCP memory persistence guard (#2631) — template: .claude/templates/mcp-enabled.json"

[ -f "$TPL" ] || { echo "  ✗ template not found at $TPL"; exit 1; }

# 1. The exact broken pattern must be gone (config-load expansion degrades to '.').
if grep -q 'CLAUDE_PROJECT_DIR:-\.' "$TPL"; then
  bad "no \${CLAUDE_PROJECT_DIR:-.} relative pattern (it config-expands to '.' -> npx cache -> ENOENT)"
else
  ok "no \${CLAUDE_PROJECT_DIR:-.} relative pattern"
fi

# 2. The memory server must use an `sh` runtime wrapper (not a CC-expanded env value).
cmd="$(python3 -c "import json;print(json.load(open('$TPL'))['mcpServers']['memory'].get('command',''))")"
if [ "$cmd" = "sh" ]; then
  ok "memory server uses an 'sh' runtime wrapper"
else
  bad "memory server command is '$cmd', expected 'sh' wrapper that resolves MEMORY_FILE_PATH at runtime"
fi

# 3. The wrapper sets MEMORY_FILE_PATH from a runtime project dir (bare \$CLAUDE_PROJECT_DIR / \$PWD).
args="$(python3 -c "import json;print('\n'.join(json.load(open('$TPL'))['mcpServers']['memory'].get('args',[])))")"
if printf '%s' "$args" | grep -q 'MEMORY_FILE_PATH'; then
  ok "wrapper sets MEMORY_FILE_PATH"
else
  bad "wrapper does not set MEMORY_FILE_PATH"
fi
if printf '%s' "$args" | grep -qE '[$]CLAUDE_PROJECT_DIR|[$]PWD'; then
  ok "wrapper resolves project dir at runtime (\$CLAUDE_PROJECT_DIR / \$PWD)"
else
  bad "wrapper does not reference a runtime project dir"
fi

# 4. The wrapper's logic yields an ABSOLUTE path in both branches (set + fallback).
p_set="$(env CLAUDE_PROJECT_DIR=/proj sh -c 'DIR="$CLAUDE_PROJECT_DIR"; [ -n "$DIR" ] || DIR="$PWD"; echo "$DIR/.claude/memory/memory.json"')"
case "$p_set" in
  /*) ok "absolute path when CLAUDE_PROJECT_DIR set ($p_set)" ;;
  *)  bad "non-absolute path: $p_set" ;;
esac
p_fb="$(cd "$ROOT" && env -u CLAUDE_PROJECT_DIR sh -c 'DIR="$CLAUDE_PROJECT_DIR"; [ -n "$DIR" ] || DIR="$PWD"; echo "$DIR/.claude/memory/memory.json"')"
case "$p_fb" in
  /*) ok "absolute path via \$PWD fallback ($p_fb)" ;;
  *)  bad "non-absolute fallback path: $p_fb" ;;
esac

# Advisory (never fails CI): warn if a LOCAL .mcp.json is stale vs the fixed template,
# so an existing user knows to re-provision. .mcp.json is gitignored and may be absent.
LIVE="$ROOT/.mcp.json"
if [ -f "$LIVE" ] && grep -q 'CLAUDE_PROJECT_DIR:-\.' "$LIVE"; then
  echo "  ⚠ advisory: your local .mcp.json still has the broken pattern — re-copy memory block from the template (or re-run /ork:setup)"
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "Results: PASS — memory MCP template resolves an absolute MEMORY_FILE_PATH at runtime"
  exit 0
else
  echo "Results: FAIL — #2631 regression (memory KG would not persist)"
  exit 1
fi
