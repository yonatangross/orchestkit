#!/usr/bin/env bash
# A build must converge in one pass. The fixture changes a source skill (which
# regenerates reference MDX), seeds a stale count in a stamped MDX page, and
# changes the package version that stamp-counts propagates before docs data reads it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_PARENT="$(mktemp -d "${TMPDIR:-/tmp}/orchestkit-build-fixed-point.XXXXXX")"
FIXTURE="$FIXTURE_PARENT/repo"
FIXTURE_VERSION="10.0.0-fixed-point.4116"
BUILD_SCRIPT_UNDER_TEST="${BUILD_SCRIPT_UNDER_TEST:-$REPO_ROOT/scripts/build-plugins.sh}"

# A caller can export these paths for its own checkout. They would make the
# fixture's Git commands operate on that checkout unless they are cleared.
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

require_path() {
  local path="$1"
  [[ -e "$path" ]] || fail "expected $path to be generated"
}

[[ -f "$BUILD_SCRIPT_UNDER_TEST" ]] || fail "build script under test not found: $BUILD_SCRIPT_UNDER_TEST"

echo "Creating isolated docs-generation fixture..."
mkdir -p "$FIXTURE"
# Archive only the inputs and outputs used by the production docs sequence.
# This avoids cloning the repository's full history for every unit-test shard.
git -C "$REPO_ROOT" archive --format=tar HEAD -- \
  .claude-plugin \
  README.md CLAUDE.md CONTRIBUTING.md package.json pyproject.toml \
  bin/count-hooks.sh \
  manifests \
  scripts/build-docs.sh scripts/_build-docs-generate.py scripts/stamp-counts.sh \
  scripts/generate-docs-data.js scripts/gen-docs-search-index.js scripts/lib \
  src/skills/commit src/agents/code-quality-reviewer.md \
  src/hooks/hooks.json src/hooks/src/lib/models.vocab.json \
  src/hooks/src/lib/cc-version-matrix.ts \
  docs/site/content/docs/foundations/overview.mdx \
  | tar -xf - -C "$FIXTURE"
git -C "$FIXTURE" init --quiet
git -C "$FIXTURE" add --all
git -C "$FIXTURE" -c user.name='Fixed Point Test' \
  -c user.email='fixed-point@example.invalid' commit --quiet -m 'test: fixture source'

# The archive intentionally starts at HEAD so it is a clean Git baseline.
# Overlay the script under test so local runs exercise an uncommitted build-order fix too.
cp "$BUILD_SCRIPT_UNDER_TEST" "$FIXTURE/scripts/build-plugins.sh"

# Alter an existing skill instead of adding one. Adding a skill would also
# change the manifest description after plugin assembly, introducing unrelated
# second-build drift that hides the docs ordering regression this test owns.
python3 - "$FIXTURE/src/skills/commit/SKILL.md" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
source = path.read_text(encoding="utf-8")
updated, replacements = re.subn(
    r"^description:.*$",
    "description: Fixed-point fixture description proves generated docs use final source data.",
    source,
    count=1,
    flags=re.MULTILINE,
)
if replacements != 1:
    raise SystemExit("fixture could not change the commit skill description")
path.write_text(updated, encoding="utf-8")
PY

# Use the small fixture's canonical count tuple, then make its MDX count
# surface stale. The first build must restore this exact content after
# generating the MDX pages.
OVERVIEW="$FIXTURE/docs/site/content/docs/foundations/overview.mdx"
eval "$(cd "$FIXTURE" && bash bin/count-hooks.sh)"
CANONICAL_OVERVIEW_DESCRIPTION="The complete AI development toolkit — 1 skills, 1 agents, ${TOTAL} hooks working together."
printf -- '---\ntitle: Fixture Overview\ndescription: %s\n---\n\n# Fixture Overview\n' \
  "$CANONICAL_OVERVIEW_DESCRIPTION" > "$OVERVIEW"
CANONICAL_OVERVIEW="$(<"$OVERVIEW")"
python3 - "$OVERVIEW" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
source = path.read_text(encoding="utf-8")
updated, replacements = re.subn(
    r"\d+ skills, \d+ agents, \d+ hooks",
    "1 skills, 1 agents, 1 hooks",
    source,
    count=1,
)
if replacements != 1:
    raise SystemExit("fixture could not seed a stale count marker")
path.write_text(updated, encoding="utf-8")
PY

# `stamp-counts.sh` propagates this to manifests/ork.json. generate-docs-data
# reads that manifest, so its placement after stamping is part of the same
# convergence property as the MDX search index.
jq --arg version "$FIXTURE_VERSION" '.version = $version' \
  "$FIXTURE/package.json" > "$FIXTURE/package.json.tmp"
mv "$FIXTURE/package.json.tmp" "$FIXTURE/package.json"

production_docs_steps() {
  # Read the invocation order from the production build script. These are the
  # only writers/readers involved in this fixed-point regression; plugin
  # assembly is deliberately outside this fast unit gate.
  python3 - "$FIXTURE/scripts/build-plugins.sh" <<'PY'
import re
import sys
from pathlib import Path

patterns = {
    "build-docs": r'bash "\$SCRIPT_DIR/build-docs\.sh"',
    "stamp-counts": r'bash "\$\(dirname "\$0"\)/stamp-counts\.sh"',
    "generate-docs-data": r'node "\$SCRIPT_DIR/generate-docs-data\.js"',
    "gen-docs-search-index": r'node "\$SCRIPT_DIR/gen-docs-search-index\.js"',
}
found = []
for line_number, line in enumerate(Path(sys.argv[1]).read_text(encoding="utf-8").splitlines(), 1):
    for name, pattern in patterns.items():
        if re.search(pattern, line):
            found.append((line_number, name))

if len(found) != len(patterns) or {name for _, name in found} != set(patterns):
    raise SystemExit(f"could not extract all production docs steps: {found}")
for _, name in sorted(found):
    print(name)
PY
}

run_production_docs_steps() {
  local step steps
  steps="$(production_docs_steps)" \
    || fail "could not extract the production docs sequence"
  [[ -n "$steps" ]] || fail "production docs sequence was empty"
  while IFS= read -r step; do
    echo "  $step"
    case "$step" in
      build-docs) (cd "$FIXTURE" && bash scripts/build-docs.sh >/dev/null) ;;
      stamp-counts) (cd "$FIXTURE" && bash scripts/stamp-counts.sh >/dev/null) ;;
      generate-docs-data) (cd "$FIXTURE" && node scripts/generate-docs-data.js >/dev/null) ;;
      gen-docs-search-index) (cd "$FIXTURE" && node scripts/gen-docs-search-index.js >/dev/null) ;;
      *) fail "unrecognized extracted production step: $step" ;;
    esac
  done <<< "$steps"
}

echo "Running first production docs sequence..."
run_production_docs_steps

require_path "$FIXTURE/docs/site/content/docs/reference/skills/commit.mdx"
grep -q 'Fixed-point fixture description proves generated docs use final source data.' \
  "$FIXTURE/docs/site/content/docs/reference/skills/commit.mdx" \
  || fail "reference MDX did not include the changed skill description"
grep -q "\"version\": \"$FIXTURE_VERSION\"" \
  "$FIXTURE/docs/site/lib/generated/plugins-data.ts" \
  || fail "docs data was generated before the stamped manifest version"
grep -q 'Fixed-point fixture description proves generated docs use final source data.' \
  "$FIXTURE/docs/site/lib/generated/docs-search-index.ts" \
  || fail "search index was generated before the regenerated reference MDX"
grep -Fq "$CANONICAL_OVERVIEW_DESCRIPTION" \
  "$FIXTURE/docs/site/lib/generated/docs-search-index.ts" \
  || fail "search index was generated before the stale count-stamped MDX was restored"
[[ "$(<"$OVERVIEW")" == "$CANONICAL_OVERVIEW" ]] \
  || fail "first build did not restore the stale count-stamped MDX"

# Treat the complete first-build output as the committed PR state. A second
# production build must leave this exact tree untouched.
git -C "$FIXTURE" add --all
git -C "$FIXTURE" -c user.name='Fixed Point Test' \
  -c user.email='fixed-point@example.invalid' commit --quiet -m 'test: fixture baseline'

echo "Running second production docs sequence..."
run_production_docs_steps

SECOND_STATUS="$(git -C "$FIXTURE" status --porcelain)"
if [[ -n "$SECOND_STATUS" ]]; then
  printf '%s\n' "$SECOND_STATUS" >&2
  fail "second production docs sequence changed the committed first-sequence output"
fi

echo "PASS: production docs sequence reaches a fixed point after regenerated MDX and stamped counts"
