#!/usr/bin/env bash
# generate-docs-data.js must not list Python bytecode junk under skill folder
# trees (references, assets, scripts, checklists). Local __pycache__/ dirs and
# *.pyc / *.pyo files must stay out of docs/site/lib/generated/skills-data.ts.
#
# Fail-first: against an unfixed scanFolderStructure this test FAILS. Override
# GENERATE_DOCS_DATA to point at a candidate script for demos.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_PARENT="$(mktemp -d "${TMPDIR:-/tmp}/orchestkit-docs-gen-skip-pycache.XXXXXX")"
FIXTURE="$FIXTURE_PARENT/repo"
SKILL_NAME="commit"
GENERATE_DOCS_DATA="${GENERATE_DOCS_DATA:-$REPO_ROOT/scripts/generate-docs-data.js}"

# Clear Git env so fixture Git (if used) cannot latch onto the caller's checkout.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_COMMON_DIR
unset GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES

cleanup() {
  rm -rf "$FIXTURE_PARENT"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

[[ -f "$GENERATE_DOCS_DATA" ]] || fail "generator under test not found: $GENERATE_DOCS_DATA"

echo "Creating isolated docs-data fixture..."
mkdir -p "$FIXTURE"
# Archive only the inputs generate-docs-data.js needs. Never plant bytecode in
# the real worktree; the contamination lives under the temp fixture only.
git -C "$REPO_ROOT" archive --format=tar HEAD -- \
  manifests \
  scripts/generate-docs-data.js scripts/lib \
  src/skills/commit \
  src/agents/code-quality-reviewer.md \
  src/hooks/hooks.json \
  src/hooks/src/lib/models.vocab.json \
  src/hooks/src/lib/cc-version-matrix.ts \
  | tar -xf - -C "$FIXTURE"

# Overlay the script under test so local runs can exercise an uncommitted fix
# (or an intentionally unfixed copy for fail-first demos).
cp "$GENERATE_DOCS_DATA" "$FIXTURE/scripts/generate-docs-data.js"
mkdir -p "$FIXTURE/docs/site/lib/generated"

SKILLS_DATA="$FIXTURE/docs/site/lib/generated/skills-data.ts"
SCRIPTS_DIR="$FIXTURE/src/skills/${SKILL_NAME}/scripts"
[[ -d "$SCRIPTS_DIR" ]] || fail "fixture skill scripts dir missing: $SCRIPTS_DIR"

extract_scripts() {
  local skills_data="$1"
  node - "$skills_data" "$SKILL_NAME" <<'NODE'
const fs = require('fs');
const skillsDataPath = process.argv[2];
const skillName = process.argv[3];
const text = fs.readFileSync(skillsDataPath, 'utf8');
const match = text.match(
  /export const SKILLS: Record<string, SkillMeta> = (\{[\s\S]*\});\s*$/
);
if (!match) {
  console.error('could not parse SKILLS export from skills-data.ts');
  process.exit(1);
}
const skills = JSON.parse(match[1]);
const skill = skills[skillName];
if (!skill || !skill.structure || !Array.isArray(skill.structure.scripts)) {
  console.error(`skill "${skillName}" missing structure.scripts`);
  process.exit(1);
}
process.stdout.write(JSON.stringify(skill.structure.scripts));
NODE
}

echo "Running baseline generate-docs-data..."
(cd "$FIXTURE" && node scripts/generate-docs-data.js >/dev/null) \
  || fail "baseline generate-docs-data.js failed"
[[ -f "$SKILLS_DATA" ]] || fail "expected $SKILLS_DATA after baseline run"

BASELINE_SCRIPTS="$(extract_scripts "$SKILLS_DATA")" \
  || fail "could not extract baseline structure.scripts for ${SKILL_NAME}"
[[ -n "$BASELINE_SCRIPTS" ]] || fail "baseline structure.scripts was empty JSON"

echo "Planting Python bytecode junk under fixture skill/scripts only..."
mkdir -p "$SCRIPTS_DIR/__pycache__"
printf 'pycache-junk' > "$SCRIPTS_DIR/__pycache__/something.pyc"
printf 'loose-pyc' > "$SCRIPTS_DIR/foo.pyc"
printf 'loose-pyo' > "$SCRIPTS_DIR/bar.pyo"

echo "Re-running generate-docs-data after planting junk..."
(cd "$FIXTURE" && node scripts/generate-docs-data.js >/dev/null) \
  || fail "second generate-docs-data.js failed"

AFTER_SCRIPTS="$(extract_scripts "$SKILLS_DATA")" \
  || fail "could not extract post-plant structure.scripts for ${SKILL_NAME}"

if [[ "$AFTER_SCRIPTS" != "$BASELINE_SCRIPTS" ]]; then
  LEAKED="$(
    node - "$BASELINE_SCRIPTS" "$AFTER_SCRIPTS" <<'NODE'
const baseline = JSON.parse(process.argv[2]);
const after = JSON.parse(process.argv[3]);
const baselineSet = new Set(baseline);
const leaked = after.filter((entry) => !baselineSet.has(entry));
process.stdout.write(leaked.join(', ') || '(unable to diff)');
NODE
  )"
  fail "structure.scripts for ${SKILL_NAME} changed after planting bytecode junk (leaked: ${LEAKED}). baseline=${BASELINE_SCRIPTS} after=${AFTER_SCRIPTS}"
fi

# Hard asserts: even if stringify somehow matched, these names must be absent.
node - "$AFTER_SCRIPTS" <<'NODE' || fail "bytecode junk still present in structure.scripts"
const scripts = JSON.parse(process.argv[2]);
const forbidden = ['__pycache__', 'foo.pyc', 'bar.pyo'];
const found = forbidden.filter((name) => scripts.includes(name));
if (found.length > 0) {
  console.error(`forbidden entries still listed: ${found.join(', ')}`);
  process.exit(1);
}
NODE

echo "PASS: generate-docs-data skips __pycache__ and *.pyc/*.pyo under skill scripts"
exit 0
