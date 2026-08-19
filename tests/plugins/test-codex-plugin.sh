#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
SOURCE_ROOT="$PROJECT_ROOT/src/codex/ork-codex"
PLUGIN_ROOT="$PROJECT_ROOT/plugins/ork-codex"
MARKETPLACE="$PROJECT_ROOT/.agents/plugins/marketplace.json"

for path in "$SOURCE_ROOT" "$PLUGIN_ROOT" "$MARKETPLACE"; do
  [[ -e "$path" ]] || { echo "FAIL: missing $path"; exit 1; }
done

expected_skills=(ork-brainstorm ork-explore ork-assess ork-verify ork-review-pr)
for skill in "${expected_skills[@]}"; do
  skill_file="$PLUGIN_ROOT/skills/$skill/SKILL.md"
  [[ -f "$skill_file" ]] || { echo "FAIL: missing $skill"; exit 1; }
  sed -n '1,8p' "$skill_file" | grep -qx -- "name: $skill" || {
    echo "FAIL: $skill has no matching skill name"; exit 1;
  }
  sed -n '1,8p' "$skill_file" | grep -qE '^description: .+' || {
    echo "FAIL: $skill has no description"; exit 1;
  }
done

expected_roles=(ork_explorer ork_implementer ork_reviewer ork_verifier)
python3 - "$SOURCE_ROOT/roles" "${expected_roles[@]}" <<'PY'
import sys
import tomllib
from pathlib import Path

roles = Path(sys.argv[1])
for name in sys.argv[2:]:
    data = tomllib.loads((roles / f"{name}.toml").read_text())
    missing = {"name", "description", "developer_instructions"} - data.keys()
    if missing or data["name"] != name:
        raise SystemExit(f"invalid role {name}: missing={sorted(missing)}")
PY

# context7 wiring. The two tool names below are the ONLY tools the context7
# server exposes; any other spelling silently grants nothing, so pin them.
jq -e '
  (.mcpServers.context7.type == "http") and
  (.mcpServers.context7.url == "https://mcp.context7.com/mcp") and
  (.mcpServers.context7.bearer_token_env_var == "CONTEXT7_API_KEY_CODEX") and
  (.mcpServers.context7.enabled_tools == ["resolve-library-id", "query-docs"]) and
  ((.mcpServers | keys) == ["context7"])
' "$PLUGIN_ROOT/mcp.json" >/dev/null || {
  echo "FAIL: mcp.json context7 wiring is wrong"; exit 1;
}

# A literal key must never be committed. Real keys carry the ctx7sk prefix.
if grep -q "ctx7sk" "$PLUGIN_ROOT/mcp.json"; then
  echo "FAIL: mcp.json contains a literal context7 API key"; exit 1
fi

jq -e --arg version "$(jq -r '.version' "$PROJECT_ROOT/package.json")" '
  .name == "ork-codex" and
  .version == $version and
  .skills == "./skills/" and
  .mcpServers == "./mcp.json" and
  (.description | type == "string" and length > 0) and
  (.author.name | type == "string" and length > 0) and
  (.interface.displayName | type == "string" and length > 0) and
  (.interface.shortDescription | type == "string" and length > 0)
' "$PLUGIN_ROOT/.codex-plugin/plugin.json" >/dev/null
jq -e '
  .name == "orchestkit-codex" and
  (.plugins[] | select(.name == "ork-codex") |
    .source.source == "git-subdir" and
    .source.url == "https://github.com/yonatangross/orchestkit.git" and
    .source.path == "./plugins/ork-codex" and
    .source.ref == "main")
' "$MARKETPLACE" >/dev/null

diff -qr "$SOURCE_ROOT" "$PLUGIN_ROOT" \
  --exclude='plugin.json' >/dev/null

echo "PASS: Codex plugin contract (5 skills, 4 roles, context7 MCP server)"
