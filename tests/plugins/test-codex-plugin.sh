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

jq -e --arg version "$(jq -r '.version' "$PROJECT_ROOT/package.json")" '
  .name == "ork-codex" and
  .version == $version and
  .skills == "./skills/" and
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

echo "PASS: Codex plugin contract (5 skills, 4 roles)"
