#!/usr/bin/env bash
# r2: same as r1-partial/run.sh, run from inside the L6 worktree (brief rule), and the server now
# declares the MCP tasks extension. usage: run.sh
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; L=r2
cat > "$D/mcp.json" <<J
{"mcpServers":{"l6elicit":{"type":"stdio","command":"node","args":["$D/server.mjs"],"env":{"SERVER_LOG":"$D/server-$L.log"}}}}
J
cat > "$D/dump-settings.json" <<J
{"hooks":{
 "Elicitation":[{"hooks":[{"type":"command","command":"cat > $D/payload-$L-Elicitation-\$\$.json"}]}],
 "ElicitationResult":[{"hooks":[{"type":"command","command":"cat > $D/payload-$L-ElicitationResult-\$\$.json"}]}]}}
J
date -u +%Y-%m-%dT%H:%M:%SZ > "$D/start-$L.txt"
cd "$D"
set +e
claude -p --model haiku --no-session-persistence --mcp-config "$D/mcp.json" --strict-mcp-config \
  --settings "$D/dump-settings.json" --allowedTools 'mcp__l6elicit__ask_in_task' \
  --debug-file "$D/debug-$L.log" "Call the ask_in_task tool exactly once and report its result text verbatim." > "$D/stdout-$L.txt" 2> "$D/stderr-$L.txt"
echo "EXIT=$?" >> "$D/stdout-$L.txt"
