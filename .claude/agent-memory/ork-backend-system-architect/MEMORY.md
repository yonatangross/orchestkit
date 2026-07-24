# Backend System Architect Memory

## Skills Created
- **right-sized-backend** (`src/skills/right-sized-backend/SKILL.md`) - Context-aware architecture sizing skill with 4 scenario reference files. Prevents over-engineering for interviews/MVPs, ensures proper structure for enterprise.

## Project Findings
- [ork-debt extension drift](project_ork_debt_extension_drift.md) — two extension lists (regex vs grep-include) drift; fix = single DEBT_SCAN_EXTENSIONS const in debt-markers.ts consumed by both

## Key Architectural Patterns
- OrchestKit uses hook-based extensibility (Level 2-3 on plugin spectrum) via `hooks.json` + TypeScript handlers
- `backend-architecture-enforcer` currently enforces clean architecture unconditionally; `right-sized-backend` proposes tier-based rule adjustment (OFF/WARN/BLOCK per project tier)
- Project tier detection via signals: file count, CI presence, K8s/Terraform presence, README content

## Skill Structure Conventions
- SKILL.md with YAML frontmatter (name, description, context: fork, agent, version, tags, user-invocable, complexity)
- References go in `references/` subdirectory
- Capability Details section required at bottom with keyword/solves blocks
- Related Skills section links to other OrchestKit skills
