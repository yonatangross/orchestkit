---
title: Detection Checks
impact: HIGH
impactDescription: "Precondition verification and environment detection before upgrade scanning"
tags: detection, environment, preconditions
---

# Detection Checks

Precondition checks and environment detection for Phase 1 of upgrade assessment.

## Precondition Checks

Before scanning, verify the environment is assessable:

```bash
# Verify we're in an OrchestKit project
[ -f CLAUDE.md ] || { echo "ERROR: No CLAUDE.md found — not an OrchestKit project"; exit 1; }
[ -d src/skills ] || { echo "ERROR: No src/skills/ directory"; exit 1; }
[ -d src/agents ] || { echo "ERROR: No src/agents/ directory"; exit 1; }
[ -f src/hooks/hooks.json ] || { echo "WARNING: No hooks.json — hook assessment will be skipped"; }
```

If any required directory is missing, abort with a clear error. If optional components (hooks) are missing, continue with reduced scope and note it in the report.

## Environment Detection

Detect the current environment state:

```bash
# 1. Current Claude model
# Check CLAUDE.md, settings, or environment for model references
grep -r "claude-" CLAUDE.md .claude/ 2>/dev/null | head -20

# 2. Claude Code version
claude --version 2>/dev/null || echo "CC version not detectable from CLI"

# 3. OrchestKit version
# Check CLAUDE.md or package.json for version field
grep "Current.*:" CLAUDE.md | head -5

# 4. Hooks configuration
cat src/hooks/hooks.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Hooks: {len(d.get(\"hooks\",[]))} entries')" 2>/dev/null

# 5. Skill and agent counts
ls src/skills/ | wc -l
ls src/agents/ | wc -l
```

## Expected Output

Environment snapshot including:
- Current model ID (e.g., `claude-sonnet-4-6`)
- Current CC version (e.g., `2.1.33`)
- Current OrchestKit version (e.g., `6.0.0`)
- Hook count and bundle count
- Skill count and agent count

**Incorrect — Running scans without precondition checks produces invalid results:**
```bash
# No environment verification
grep -r "claude-" src/  # Scans in non-OrchestKit project
# False positives and missed files
```

**Correct — Precondition checks ensure valid assessment environment:**
```bash
# Verify OrchestKit project structure
[ -f CLAUDE.md ] && [ -d src/skills ] || exit 1
# Only scan if structure is valid
grep -r "claude-" src/skills/ --include="*.md"
```
