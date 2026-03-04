#!/usr/bin/env bash
# test-mcp-overhead.sh — CI regression gate for MCP scoping (#945)
#
# Asserts:
#   1. Every agent .md file has an explicit mcpServers field
#   2. All Haiku model agents have <= 5 MCP servers
#   3. notebooklm-mcp is absent from non-notebook agent mcpServers
#
# Exit 1 on any violation. Runs in CI (validate.yml).

set -euo pipefail

AGENTS_DIR="$(cd "$(dirname "$0")/../../src/agents" && pwd)"
FAIL=0

# ---------------------------------------------------------------------------
# check_agent — node parses YAML frontmatter for robust extraction
# Passes the agent file path via process.argv (no shell injection)
# ---------------------------------------------------------------------------
check_agent() {
  local agent_path="$1"

  local result
  result="$(node -e "
    const fs = require('fs');
    const file = process.argv[1];
    const content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const name = require('path').basename(file, '.md');

    // Extract YAML frontmatter between first pair of --- lines
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      process.stdout.write('NO_FRONTMATTER|' + name + '\n');
      process.exit(0);
    }

    const fm = fmMatch[1];

    // Extract model value (single-line)
    const modelMatch = fm.match(/^model:\s*(.+)$/m);
    const model = modelMatch ? modelMatch[1].trim() : '';

    // Extract mcpServers — supports both single-line ([a, b]) and block list (- a\n- b)
    const singleLine = fm.match(/^mcpServers:\s*\[([^\]]*)\]/m);
    const blockList  = fm.match(/^mcpServers:\s*\n((?:[ \t]*-[ \t]+\S[^\n]*\n?)+)/m);
    const emptyField = /^mcpServers:\s*\[\s*\]/m.test(fm);
    const hasField   = /^mcpServers:/m.test(fm);

    if (!hasField) {
      process.stdout.write('MISSING_MCP|' + name + '\n');
      process.exit(0);
    }

    let servers = [];
    if (singleLine && singleLine[1].trim()) {
      servers = singleLine[1].split(',').map(s => s.trim()).filter(Boolean);
    } else if (blockList) {
      servers = blockList[1].split('\n')
        .map(l => l.replace(/^[ \t]*-[ \t]+/, '').trim())
        .filter(Boolean);
    }
    // emptyField or unmatched = 0 servers

    process.stdout.write('OK|' + name + '|' + model + '|' + servers.length + '|' + servers.join(',') + '\n');
  " -- "$agent_path" 2>/dev/null)"

  # Parse output line
  local status="${result%%|*}"
  local rest="${result#*|}"

  case "$status" in
    NO_FRONTMATTER)
      echo "FAIL [${rest}]: no YAML frontmatter" >&2
      FAIL=1
      return
      ;;
    MISSING_MCP)
      echo "FAIL [${rest}]: missing mcpServers field" >&2
      FAIL=1
      return
      ;;
    OK)
      local name="${rest%%|*}"; rest="${rest#*|}"
      local model="${rest%%|*}"; rest="${rest#*|}"
      local count="${rest%%|*}"; rest="${rest#*|}"
      local servers="$rest"

      # 2. Haiku agents must have <= 5 MCP servers
      if [[ "$model" == haiku* ]]; then
        if [[ "$count" -gt 5 ]]; then
          echo "FAIL [$name]: Haiku agent has $count MCP servers (max 5)" >&2
          FAIL=1
        fi
      fi

      # 3. notebooklm-mcp only for notebook-related agents
      local allowed_nlm="release-notebook demo-producer"
      if echo "$servers" | grep -q "notebooklm"; then
        if ! echo "$allowed_nlm" | grep -qw "$name"; then
          echo "FAIL [$name]: notebooklm-mcp in mcpServers (allowed only for: $allowed_nlm)" >&2
          FAIL=1
        fi
      fi
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
agent_files=("$AGENTS_DIR"/*.md)
echo "=== MCP Overhead Regression Gate (#945) ==="
echo "Scanning ${#agent_files[@]} agents..."

for agent_file in "${agent_files[@]}"; do
  check_agent "$agent_file"
done

if [[ "$FAIL" -eq 0 ]]; then
  echo "PASS: All agents have explicit mcpServers, Haiku agents <= 5 tools, notebooklm-mcp scoped correctly."
  exit 0
else
  echo "FAIL: MCP overhead regression detected. Fix the issues above." >&2
  exit 1
fi
