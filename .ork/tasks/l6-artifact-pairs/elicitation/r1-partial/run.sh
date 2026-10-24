#!/usr/bin/env bash
# usage: run.sh <label> <prompt>
set -euo pipefail
D="$TMPDIR/l6-elicit"; L="$1"; P="$2"
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
  --settings "$D/dump-settings.json" --allowedTools 'mcp__l6elicit__ask_plain,mcp__l6elicit__ask_secret,mcp__l6elicit__ask_in_task' \
  --debug-file "$D/debug-$L.log" "$P" > "$D/stdout-$L.txt" 2> "$D/stderr-$L.txt"
echo "EXIT=$?" >> "$D/stdout-$L.txt"
