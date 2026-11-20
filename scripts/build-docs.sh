#!/usr/bin/env bash
set -euo pipefail

# build-docs.sh - Auto-generate Fumadocs MDX reference pages from OrchestKit source files.
#
# Reads:
#   src/skills/*/SKILL.md        (skill definitions with YAML frontmatter)
#   src/agents/*.md              (agent definitions with YAML frontmatter)
#   src/hooks/hooks.json         (hook lifecycle definitions)
#
# Outputs:
#   docs/site/content/docs/reference/skills/   - one MDX per skill + index
#   docs/site/content/docs/reference/agents/   - one MDX per agent + index
#   docs/site/content/docs/reference/hooks/    - one MDX per hook category + index
#
# Usage: ./scripts/build-docs.sh  (run from project root)

START_TIME=$(date +%s)

# -- Paths -------------------------------------------------------------------
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_SRC="$PROJECT_ROOT/src/skills"
AGENTS_SRC="$PROJECT_ROOT/src/agents"
HOOKS_JSON="$PROJECT_ROOT/src/hooks/hooks.json"
DOCS_SITE="$PROJECT_ROOT/docs/site"
DOCS_ROOT="$DOCS_SITE/content/docs"

if ! command -v python3 >/dev/null || ! python3 -c 'import sys; sys.exit(sys.version_info < (3, 11))'; then
    echo "Error: generating reference docs requires Python 3.11 or newer (python3 on PATH)." >&2
    exit 1
fi

# Generate separately so a failed generator cannot alter the last good docs.
mkdir -p "$DOCS_SITE"
STAGING_DIR=$(mktemp -d "$DOCS_SITE/.build-docs.XXXXXX")
trap 'rm -rf "$STAGING_DIR"' EXIT

DOCS_OUT="$STAGING_DIR/reference"
SKILLS_OUT="$DOCS_OUT/skills"
AGENTS_OUT="$DOCS_OUT/agents"
HOOKS_OUT="$DOCS_OUT/hooks"
CATEGORIES_OUT="$STAGING_DIR/skills/by-category"
REFSKILLS_OUT="$STAGING_DIR/skills/reference-skills.mdx"
mkdir -p "$SKILLS_OUT" "$AGENTS_OUT" "$HOOKS_OUT" "$CATEGORIES_OUT"

export PROJECT_ROOT SKILLS_SRC AGENTS_SRC HOOKS_JSON DOCS_OUT SKILLS_OUT AGENTS_OUT HOOKS_OUT CATEGORIES_OUT REFSKILLS_OUT
python3 "$PROJECT_ROOT/scripts/_build-docs-generate.py"

# Replace only generator-owned paths, removing stale pages on success.
mkdir -p "$DOCS_ROOT/reference" "$DOCS_ROOT/skills"
for dir in reference/skills reference/agents reference/hooks skills/by-category; do
    rm -rf "${DOCS_ROOT:?}/$dir"
    mv "$STAGING_DIR/$dir" "$DOCS_ROOT/$dir"
done
for file in reference/meta.json skills/reference-skills.mdx skills/command-skills.mdx; do
    mv -f "$STAGING_DIR/$file" "$DOCS_ROOT/$file"
done

# -- Timing -------------------------------------------------------------------
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
echo ""
echo "Done. Generated reference docs in ${ELAPSED}s."
