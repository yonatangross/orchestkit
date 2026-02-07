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
DOCS_OUT="$PROJECT_ROOT/docs/site/content/docs/reference"

SKILLS_OUT="$DOCS_OUT/skills"
AGENTS_OUT="$DOCS_OUT/agents"
HOOKS_OUT="$DOCS_OUT/hooks"

# -- Clean output directories ------------------------------------------------
echo "Cleaning output directories..."
rm -rf "$SKILLS_OUT" "$AGENTS_OUT" "$HOOKS_OUT"
mkdir -p "$SKILLS_OUT" "$AGENTS_OUT" "$HOOKS_OUT"

# -- Run Python generator (handles all three: skills, agents, hooks) ---------
export PROJECT_ROOT SKILLS_SRC AGENTS_SRC HOOKS_JSON DOCS_OUT SKILLS_OUT AGENTS_OUT HOOKS_OUT
python3 "$PROJECT_ROOT/scripts/_build-docs-generate.py"

# -- Timing -------------------------------------------------------------------
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
echo ""
echo "Done. Generated reference docs in ${ELAPSED}s."
