#!/usr/bin/env bash
# scripts/export-gemini-skills.mjs: one pass fixture and five refusals.
# The Gemini app rules come from support.google.com/gemini/answer/17094296
# (lowercase-hyphen name, a SKILL.md in the zip's main folder, plain text only)
# plus the 1024-character description limit. A chat app cannot run MCP tools.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/export-gemini-skills.mjs"

FIX="$(mktemp -d "${TMPDIR:-/tmp}/ork-gemini-export.XXXXXX")"
cleanup() { rm -rf "$FIX"; }
trap cleanup EXIT

pass=0
fail=0
ok() { echo "  PASS: $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL: $1"; fail=$((fail + 1)); }

# make_skill <folder> <name> <description> [extra body line]
make_skill() {
  local dir="$FIX/skills/$1"
  mkdir -p "$dir/references"
  {
    echo "---"
    echo "name: $2"
    echo "description: \"$3\""
    echo "compatibility: \"Claude Code 2.1.277+\""
    echo "allowed-tools: \"Read Grep\""
    echo "---"
    echo ""
    echo "# A method"
    echo "Use the checklist in references/guide.md."
    if [[ -n "${4:-}" ]]; then echo "$4"; fi
  } > "$dir/SKILL.md"
  echo "Step one. Step two." > "$dir/references/guide.md"
  echo '{"cases":[]}' > "$dir/test-cases.json"
}

run_export() {
  local out="$1"; shift
  node "$SCRIPT" --skills-dir "$FIX/skills" --out "$out" --skills "$@" >"$out.log" 2>&1
}

# 1. Pass: a clean skill exports to a zip whose main folder holds SKILL.md.
make_skill good-skill good-skill "A clean method skill."
OUT="$FIX/out-good"
rc=0
run_export "$OUT" good-skill || rc=$?
LIST="$FIX/good-list.txt"
FRONT="$FIX/good-front.txt"
: > "$LIST"
: > "$FRONT"
if [[ -f "$OUT/good-skill.zip" ]]; then
  unzip -Z1 "$OUT/good-skill.zip" > "$LIST"
  unzip -p "$OUT/good-skill.zip" good-skill/SKILL.md > "$FIX/good-skill.md"
  sed -n '1,4p' "$FIX/good-skill.md" > "$FRONT"
fi
if [[ "$rc" -eq 0 ]] \
  && grep -qx 'good-skill/SKILL.md' "$LIST" \
  && grep -qx 'good-skill/references/guide.md' "$LIST" \
  && ! grep -q 'test-cases.json' "$LIST" \
  && grep -qx 'name: good-skill' "$FRONT" \
  && ! grep -qE 'allowed-tools|compatibility' "$FRONT" \
  && grep -q '"sha256"' "$OUT/manifest.json"; then
  ok "clean skill exports: SKILL.md in the main folder, frontmatter cut to name and description, test-cases.json dropped"
else
  bad "clean skill export (rc=$rc)"; cat "$OUT.log" "$LIST" "$FRONT"
fi

# refuse <label> <folder> <expected output fragment>
refuse() {
  local label="$1" folder="$2" want="$3"
  local out="$FIX/out-$folder"
  local rc=0
  run_export "$out" "$folder" || rc=$?
  if [[ "$rc" -eq 1 ]] && grep -qF "$want" "$out.log" && [[ ! -e "$out/$folder.zip" ]]; then
    ok "$label"
  else
    bad "$label (rc=$rc, want exit 1 + \"$want\" + no zip)"; cat "$out.log"
  fi
}

# 2. A description over 1024 characters.
LONG="$(printf 'x%.0s' $(seq 1 1025))"
make_skill long-desc long-desc "$LONG"
refuse "a 1025-character description is refused" long-desc "description is 1025 characters"

# 3. A name that is not lowercase words joined by hyphens.
make_skill bad-name Bad_Name "A method."
refuse "an upper-case, underscored name is refused" bad-name 'is not lowercase words joined by hyphens'

# 4. A hidden file left in the folder.
make_skill hidden-file hidden-file "A method."
touch "$FIX/skills/hidden-file/references/.DS_Store"
refuse "a .DS_Store in the folder is refused" hidden-file 'hidden file references/.DS_Store'

# 5. A body that names an MCP tool.
make_skill uses-mcp uses-mcp "A method." "Then call mcp__memory__search_nodes for the graph."
refuse "a skill that names an MCP tool is refused" uses-mcp 'names an MCP tool'

# 6. A symlink in the folder: its target must never reach the zip.
make_skill has-link has-link "A method."
echo "SECRET-KEY-MATERIAL" > "$FIX/outside-secret.txt"
ln -s "$FIX/outside-secret.txt" "$FIX/skills/has-link/references/notes.md"
refuse "a symlink in the folder is refused (its target is never exported)" has-link 'references/notes.md is a symlink'

echo ""
echo "export-gemini-skills: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
