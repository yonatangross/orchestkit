#!/usr/bin/env bash
set -uo pipefail
REPO="${REPO:?set by the fault-arms runner}"
H="${H:?set by the fault-arms runner}"
FIX="$H/fixtures/validate-counts"

( cd "$REPO" && bash bin/validate-counts.sh ) >&2
control_rc=$?

# fault: every version surface guarded by [[ -f ]] is ABSENT.
# Present: package.json, plugins/ork/.claude-plugin/plugin.json (correct counts),
#          src/skills, src/agents, src/hooks/hooks.json, bin/.
# Absent : .release-please-manifest.json, manifests/ork.json, pyproject.toml,
#          CLAUDE.md, .claude-plugin/marketplace.json.
rm -rf "$FIX"; mkdir -p "$FIX/bin" "$FIX/src/hooks" "$FIX/plugins/ork/.claude-plugin"
cp "$REPO/bin/validate-counts.sh" "$REPO/bin/count-hooks.sh" "$FIX/bin/"
cp "$REPO/package.json" "$FIX/"
cp "$REPO/src/hooks/hooks.json" "$FIX/src/hooks/"
cp "$REPO/plugins/ork/.claude-plugin/plugin.json" "$FIX/plugins/ork/.claude-plugin/"
cp -R "$REPO/src/skills" "$FIX/src/skills"
cp -R "$REPO/src/agents" "$FIX/src/agents"
bash "$FIX/bin/validate-counts.sh" >&2
fault_rc=$?

printf 'RESULT gate=%s control=%s fault=%s\n' "validate-counts" "$control_rc" "$fault_rc"
