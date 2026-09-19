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

expected_skills=(ork-brainstorm ork-explore ork-assess ork-verify ork-review-pr ork-implement ork-glyph)
# The built manifest discovers a directory, not an array of skill names.
# Resolve that path so the presence check proves the skill is exported.
skills_path="$(jq -er '.skills | select(type == "string")' "$PLUGIN_ROOT/.codex-plugin/plugin.json")"
jq -e '.skills | index("ork-glyph") != null' \
  "$PROJECT_ROOT/manifests/codex/ork-codex.json" >/dev/null || {
  echo "FAIL: Codex source manifest does not declare ork-glyph"; exit 1;
}
for skill in "${expected_skills[@]}"; do
  skill_file="$PLUGIN_ROOT/$skills_path/$skill/SKILL.md"
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

# ── The mech profile (#4002) ───────────────────────────────────────────────
# `codex --profile <name>` layers $CODEX_HOME/<name>.config.toml over the base
# config (codex-cli 0.153.4). A legacy `[profiles.<name>]` table is a hard
# config-load error under that flag, so the shipped file is checked for shape,
# for the sandbox staying on, and for the two contracts a TOML file cannot
# express (blocking stdin, and the worktree git-common-dir).
PROFILE="profiles/ork-mech.config.toml"
python3 "$SCRIPT_DIR/codex/check-profile.py" \
  "$SOURCE_ROOT/$PROFILE" "$PLUGIN_ROOT/$PROFILE"

# The manifest names what ork-codex ships. A profile added to the tree and not to
# the manifest, or renamed in one place only, is the two-sources-of-truth drift
# the count-sync rule exists for.
python3 "$SCRIPT_DIR/codex/check-manifest-profiles.py" \
  "$PROJECT_ROOT/manifests/codex/ork-codex.json" "$SOURCE_ROOT/profiles"

# The installer is what turns the shipped file into a usable profile, and its
# two refusals are the whole point: clobbering an existing profile, and
# installing next to the legacy table that would make --profile fail later.
for script in install-codex-roles.sh install-codex-profile.sh; do
  path="$PLUGIN_ROOT/scripts/$script"
  [[ -x "$path" ]] || { echo "FAIL: $script is missing or not executable"; exit 1; }
  bash -n "$path" || { echo "FAIL: $script does not parse"; exit 1; }
done

grep -q 'refusing to overwrite existing profile' "$PLUGIN_ROOT/scripts/install-codex-profile.sh" \
  || { echo "FAIL: install-codex-profile.sh lost its overwrite refusal"; exit 1; }
grep -q 'legacy \[profiles\.' "$PLUGIN_ROOT/scripts/install-codex-profile.sh" \
  || { echo "FAIL: install-codex-profile.sh lost its legacy-table refusal"; exit 1; }

diff -qr "$SOURCE_ROOT" "$PLUGIN_ROOT" \
  --exclude='plugin.json' \
  --exclude='jev-shadow-runtime.integrity.json' >/dev/null

jq -e '
  .jevShadow.mode == "disabled-by-default" and
  .jevShadow.runtime == "plugins/ork-codex/runtime/jev-shadow-runtime.mjs" and
  (.jevShadow.runtime_sha256 | test("^[a-f0-9]{64}$")) and
  .jevShadow.activation == "manual-explicit-JEV_SHADOW_ROOT-only"
' "$PROJECT_ROOT/manifests/codex/ork-codex.json" >/dev/null || {
  echo "FAIL: Codex Jev shadow manifest contract is wrong"; exit 1;
}

test -f "$PLUGIN_ROOT/runtime/jev-shadow-runtime.mjs" || { echo "FAIL: missing Jev runtime"; exit 1; }
test -f "$PLUGIN_ROOT/hooks/jev-shadow-runtime.integrity.json" || { echo "FAIL: missing Jev runtime integrity"; exit 1; }
runtime_hash="$(shasum -a 256 "$PLUGIN_ROOT/runtime/jev-shadow-runtime.mjs" | awk '{print $1}')"
source_runtime_hash="$(shasum -a 256 "$SOURCE_ROOT/runtime/jev-shadow-runtime.mjs" | awk '{print $1}')"
[[ "$source_runtime_hash" == "$runtime_hash" ]] || { echo "FAIL: source and generated Jev runtimes differ"; exit 1; }
jq -e --arg hash "$runtime_hash" '.runtime_sha256 == $hash' \
  "$PLUGIN_ROOT/hooks/jev-shadow-runtime.integrity.json" >/dev/null || {
  echo "FAIL: Jev runtime integrity does not pin the built bytes"; exit 1;
}
jq -e --arg hash "$runtime_hash" '.jevShadow.runtime_sha256 == $hash' \
  "$PROJECT_ROOT/manifests/codex/ork-codex.json" >/dev/null || {
  echo "FAIL: Jev runtime bytes do not match the manifest pin"; exit 1;
}

# This uses the generated adapter exactly as a Codex command hook would. The
# fragment remains unwired until an operator copies it into Codex settings.
fixture_base="/tmp/sc33/jev-foundation-fixtures"
mkdir -p "$fixture_base"
fixture_base="$(cd "$fixture_base" && pwd -P)"
fixture_root="$(mktemp -d "$fixture_base/codex-hook.XXXXXX")"
trap 'rm -rf "$fixture_root"' EXIT
for event in SessionStart UserPromptSubmit PreToolUse PostToolUse; do
  payload='{}'
  [[ "$event" == "SessionStart" ]] && payload='{"session_id":"fixture-session"}'
  hook_stdout="$(printf '%s' "$payload" | JEV_SHADOW_ROOT="$fixture_root" JEV_SHADOW_NAMESPACE="fixture_host" \
    node "$PLUGIN_ROOT/hooks/jev-shadow-hook.mjs" "$event")"
  [[ -z "$hook_stdout" ]] || { echo "FAIL: Jev hook emitted non-neutral stdout for $event"; exit 1; }
done
mapfile -t journals < <(find "$fixture_root" -name journal.jsonl -type f -print)
[[ ${#journals[@]} -eq 2 ]] || { echo "FAIL: Jev hook did not separate known and unknown sessions"; exit 1; }
all_rows="$(mktemp "$fixture_base/codex-hook-rows.XXXXXX")"
trap 'rm -rf "$fixture_root" "$all_rows"' EXIT
cat "${journals[@]}" > "$all_rows"
jq -s '
  ["schema_version","namespace","producer","seam","mode","decision_id","phase","harness","session_id","prompt_id","router","jev_pick","jev_confidence","incumbent_pick","agree","floor","decided_by","unknown_reason"] as $keys |
  length == 4 and
  ([.[].seam] | sort) == ["codex-passive:PostToolUse","codex-passive:PreToolUse","codex-passive:SessionStart","codex-passive:UserPromptSubmit"] and
  ([.[] | select(.session_id == "fixture-session")] | length) == 1 and
  all(.[]; (. as $row | .prompt_id == null and .incumbent_pick.status == "unobserved" and (. | has("tool_input") | not) and (. | has("tool_response") | not)
    and all($keys[]; . as $key | $row | has($key))))
' "$all_rows" >/dev/null || { echo "FAIL: Jev hook fixture leaked or lost its contract"; exit 1; }

echo "PASS: Codex plugin contract (7 skills, 4 roles, context7 MCP server, ork-mech profile)"
