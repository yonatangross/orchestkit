#!/bin/bash
# Decision Entity Extractor - Extracts entities for knowledge graph
# Hook: PostToolUse (Skill)
# CC 2.1.7 Compliant
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "skill/decision-entity-extractor"
