# SkillForge Standardization & Bug Fix Plan

## Overview

This plan addresses three major areas:
1. **Critical Bugs** - Dead agent hooks, broken test validation
2. **Skills Standardization** - Align with CC 2.1.7 official spec
3. **Agent Improvements** - Better routing, context efficiency, proper hook usage

**Total Estimated Effort**: 6-8 hours
**Risk Level**: Medium (affects all 92 skills and 20 agents)

---

## Phase 1: Critical Bug Fixes (Priority: URGENT)

### 1.1 Fix Agent Frontmatter Hooks Strategy

**Current Problem:**
```yaml
# ALL 20 agents reference non-existent paths:
hooks:
  Stop:
    - command: "$CLAUDE_PROJECT_DIR/.claude/hooks/agent/output-validator.sh"  # DOESN'T EXIST
    - command: "$CLAUDE_PROJECT_DIR/.claude/hooks/agent/context-publisher.sh"  # DOESN'T EXIST
    - command: "$CLAUDE_PROJECT_DIR/.claude/hooks/agent/handoff-preparer.sh"   # DOESN'T EXIST
```

**Chosen Approach: Hybrid (Remove dead + Add purposeful agent-specific hooks)**

Why agent-specific hooks ARE valuable:
- **Write-restricted agents** (debug-investigator, code-quality-reviewer) should have PreToolUse guards
- **Security-sensitive agents** (security-auditor) need different validation than general agents
- **Read-only agents** shouldn't trigger write hooks at all

**Action Items:**

#### 1.1.1 Remove Dead Global Hooks from ALL Agents
```yaml
# REMOVE from all 20 agent frontmatter:
hooks:
  Stop:
    - command: "$CLAUDE_PROJECT_DIR/.claude/hooks/agent/output-validator.sh"
    - command: "$CLAUDE_PROJECT_DIR/.claude/hooks/agent/context-publisher.sh"
    - command: "$CLAUDE_PROJECT_DIR/.claude/hooks/agent/handoff-preparer.sh"
```

These are redundant because `plugin.json` SubagentStop already runs globally.

#### 1.1.2 Add Purposeful Agent-Specific Hooks (WHERE NEEDED)

**Read-Only Agents** (should block writes):
- `debug-investigator`
- `code-quality-reviewer`
- `skf:system-design-reviewer`
- `ux-researcher`
- `market-intelligence`

```yaml
# ADD to read-only agents:
hooks:
  PreToolUse:
    - matcher: "Write|Edit"
      command: "${CLAUDE_PLUGIN_ROOT}/hooks/agent/block-writes.sh"
```

**Security-Sensitive Agents** (extra validation):
- `security-auditor`
- `skf:security-layer-auditor`

```yaml
# ADD to security agents:
hooks:
  PostToolUse:
    - matcher: "Bash"
      command: "${CLAUDE_PLUGIN_ROOT}/hooks/agent/security-command-audit.sh"
```

**Database Agents** (migration safety):
- `skf:database-engineer`

```yaml
# ADD to database agents:
hooks:
  PreToolUse:
    - matcher: "Bash"
      command: "${CLAUDE_PLUGIN_ROOT}/hooks/agent/migration-safety-check.sh"
```

#### 1.1.3 Create Agent Hook Directory & Scripts
```bash
mkdir -p hooks/agent/
```

**Files to create:**
| Script | Purpose | Used By |
|--------|---------|---------|
| `block-writes.sh` | Blocks Write/Edit for read-only agents | 5 agents |
| `security-command-audit.sh` | Extra logging for security operations | 2 agents |
| `migration-safety-check.sh` | Validates DB commands are safe | 1 agent |

---

### 1.2 Fix Test Validation

**Current Bug:** `test-agent-required-hooks.sh` only checks if string exists, not if path resolves.

**Action Items:**

#### 1.2.1 Update test-agent-required-hooks.sh
```bash
# ADD path validation:
validate_hook_paths() {
    local agent_file="$1"
    local errors=0

    # Extract hook commands from frontmatter
    while IFS= read -r hook_cmd; do
        # Resolve variables
        resolved_path=$(echo "$hook_cmd" | sed "s|\${CLAUDE_PLUGIN_ROOT}|$PROJECT_ROOT|g")
        resolved_path=$(echo "$resolved_path" | sed "s|\${CLAUDE_PROJECT_DIR}|$PROJECT_ROOT|g")

        if [[ ! -f "$resolved_path" ]]; then
            echo "ERROR: Hook path not found: $resolved_path"
            ((errors++))
        fi
    done < <(grep -A 20 "^hooks:" "$agent_file" | grep "command:" | sed 's/.*command: *"\(.*\)"/\1/')

    return $errors
}
```

#### 1.2.2 Add New Test: test-agent-hook-paths.sh
```bash
#!/usr/bin/env bash
# Validates all hook paths in agent frontmatter resolve to actual files

for agent in agents/*.md; do
    validate_hook_paths "$agent" || FAILED=1
done
```

---

## Phase 2: Skills Standardization (Priority: HIGH)

### 2.1 Description Field Enhancement

**Problem:** Official CC uses `description` for discovery. Our triggers are in capabilities.json (not used by CC).

**Action Items:**

#### 2.1.1 Migrate Trigger Keywords to Descriptions

For each of 92 skills, update SKILL.md frontmatter:

```yaml
# BEFORE:
description: Smart git commit with validation, conventional format, and branch protection

# AFTER:
description: Creates git commits with conventional format, branch protection, and pre-commit validation. Use when committing changes, staging files, generating commit messages, saving changes, or pushing changes.
```

**Template for good descriptions:**
```
[What it does]. Use when [trigger scenarios]. Supports [key capabilities].
```

#### 2.1.2 Create Description Migration Script
```bash
# bin/migrate-skill-descriptions.sh
# Reads capabilities.json triggers and merges into SKILL.md description
```

#### 2.1.3 Skills Requiring Description Updates (Priority Order)

| Skill | Current Description | Issue |
|-------|---------------------|-------|
| `implement` | "Full-power feature implementation..." | Too vague, no triggers |
| `best-practices` | "View and manage your personal..." | Missing "when to use" |
| `explore` | "Thorough codebase exploration..." | Missing trigger keywords |
| `commit` | "Smart git commit..." | Good but missing triggers |
| All 88 others | Various | Need trigger keywords |

---

### 2.2 Deprecate capabilities.json Runtime Usage

**Problem:** CC doesn't use capabilities.json. It's dead weight at runtime.

**Action Items:**

#### 2.2.1 Document capabilities.json as Development Tool
```markdown
# In CLAUDE.md, update:
## capabilities.json Purpose
- **Development**: Define skill metadata during authoring
- **Build**: Generate optimized SKILL.md descriptions
- **Documentation**: Track skill relationships
- **NOT Runtime**: CC discovers skills via SKILL.md description only
```

#### 2.2.2 Create Build Script
```bash
# bin/build-skill-descriptions.sh
# Generates SKILL.md descriptions from capabilities.json
# Run before releases to ensure descriptions include all triggers
```

#### 2.2.3 Add Schema Note
```json
// In skill-capabilities.schema.json, add:
"$comment": "NOTE: This file is for development/documentation. Claude Code discovers skills via SKILL.md description field only."
```

---

### 2.3 Trim Verbose Skills

**Problem:** Official spec says SKILL.md body should be under 500 lines.

**Skills Over 500 Lines:**
| Skill | Lines | Action |
|-------|-------|--------|
| `api-design-framework` | ~980 | Split into references |
| `react-server-components-framework` | ~600 | Move patterns to references |
| `database-schema-designer` | ~550 | Extract migration patterns |

#### 2.3.1 Split api-design-framework
```
BEFORE:
api-design-framework/
├── SKILL.md (980 lines)
└── references/
    └── rest-patterns.md

AFTER:
api-design-framework/
├── SKILL.md (300 lines - overview only)
└── references/
    ├── rest-patterns.md
    ├── graphql-patterns.md (NEW - extracted)
    ├── grpc-patterns.md (NEW - extracted)
    ├── error-handling.md (NEW - extracted)
    └── frontend-integration.md (NEW - extracted)
```

---

### 2.4 Add Skill Evaluations

**Problem:** No documented evaluations per official best practices.

#### 2.4.1 Create Evaluation Schema
```json
// .claude/schemas/skill-evaluation.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["skill", "evaluations"],
  "properties": {
    "skill": {"type": "string"},
    "evaluations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["query", "expected_behavior"],
        "properties": {
          "query": {"type": "string"},
          "expected_behavior": {"type": "array", "items": {"type": "string"}},
          "files": {"type": "array", "items": {"type": "string"}}
        }
      }
    }
  }
}
```

#### 2.4.2 Create Evaluations for Top 10 Skills
Priority skills (most used):
1. `commit`
2. `implement`
3. `explore`
4. `create-pr`
5. `review-pr`
6. `fix-issue`
7. `api-design-framework`
8. `unit-testing`
9. `database-schema-designer`
10. `rag-retrieval`

---

## Phase 3: Agent Improvements (Priority: MEDIUM)

### 3.1 Merge Auto Mode into Description

**Problem:** CC routes based on `description`, not body content.

**Current Pattern (Wrong):**
```yaml
description: "Debug specialist who performs systematic root cause analysis..."
---
## Auto Mode
Activates for: bug, error, exception, crash, failing, broken...
```

**Correct Pattern:**
```yaml
description: "Debug specialist who performs systematic root cause analysis on bugs, errors, exceptions, crashes, and failing tests. Use when investigating broken functionality, tracing execution paths, or analyzing logs."
```

#### 3.1.1 Update All 20 Agent Descriptions

| Agent | Auto Mode Keywords to Add |
|-------|---------------------------|
| `debug-investigator` | bug, error, exception, crash, failing |
| `backend-system-architect` | API design, database schema, microservice |
| `frontend-ui-developer` | React, component, UI, TypeScript |
| `test-generator` | test, coverage, unit test, integration |
| `security-auditor` | vulnerability, security scan, OWASP |
| ... | (16 more agents) |

#### 3.1.2 Remove Auto Mode Section from Body
After merging keywords into description, remove redundant body section.

---

### 3.2 Optimize Context Modes

**Current State:**
- 17 agents use `context: fork`
- 3 agents use `context: inherit`
- 0 agents use `context: none`

**Recommended Changes:**

| Agent | Current | Recommended | Rationale |
|-------|---------|-------------|-----------|
| `debug-investigator` | fork | inherit | Read-only, benefits from parent context |
| `code-quality-reviewer` | fork | inherit | Read-only, needs full context |
| `ux-researcher` | fork | inherit | Research-focused, needs context |
| `market-intelligence` | fork | inherit | Research-focused, needs context |
| `skf:system-design-reviewer` | fork | inherit | Review-focused, needs context |

**Token Savings:** ~5 agents × ~2000 tokens = ~10,000 tokens saved per session

---

### 3.3 Add once: true for One-Time Validations

**Candidates:**
```yaml
# In plugin.json SubagentStart:
{
  "command": "${CLAUDE_PLUGIN_ROOT}/hooks/subagent-start/subagent-validator.sh",
  "once": true  # Only validate once per session
}

# In plugin.json SessionStart:
{
  "command": "${CLAUDE_PLUGIN_ROOT}/hooks/lifecycle/analytics-consent-check.sh",
  "once": true  # Only check once
}
```

---

## Phase 4: Test Coverage (Priority: MEDIUM)

### 4.1 New Tests to Add

| Test | Purpose | File |
|------|---------|------|
| Hook path validation | Verify all hook paths exist | `tests/agents/test-hook-paths.sh` |
| Description trigger coverage | Verify descriptions have keywords | `tests/skills/test-description-triggers.sh` |
| Context isolation | Verify fork/inherit behavior | `tests/agents/test-context-modes.sh` |
| Skill line count | Verify < 500 lines | `tests/skills/test-skill-length.sh` |
| Auto Mode migration | Verify no Auto Mode in body | `tests/agents/test-auto-mode-in-description.sh` |

### 4.2 Update Existing Tests

| Test | Update Needed |
|------|---------------|
| `test-agent-required-hooks.sh` | Add path resolution validation |
| `test-agent-frontmatter.sh` | Validate description has trigger keywords |
| `test-skill-structure.sh` | Check SKILL.md line count |

---

## Implementation Order

### Day 1: Critical Fixes (2-3 hours)

| # | Task | Time | Impact |
|---|------|------|--------|
| 1 | Remove dead hooks from 20 agents | 30 min | -3000 tokens |
| 2 | Create `hooks/agent/` directory | 10 min | Infrastructure |
| 3 | Create `block-writes.sh` for read-only agents | 20 min | Security |
| 4 | Add purposeful hooks to 5 read-only agents | 30 min | Enforcement |
| 5 | Fix `test-agent-required-hooks.sh` | 20 min | Validation |
| 6 | Create `test-hook-paths.sh` | 20 min | Prevention |
| 7 | Run all tests, verify green | 15 min | Verification |

### Day 2: Agent Improvements (2-3 hours)

| # | Task | Time | Impact |
|---|------|------|--------|
| 8 | Merge Auto Mode keywords into descriptions (20 agents) | 1.5 hr | Routing fix |
| 9 | Change context mode for 5 read-only agents | 30 min | -10k tokens |
| 10 | Add `once: true` to one-time hooks | 15 min | Minor optimization |
| 11 | Create `test-auto-mode-in-description.sh` | 20 min | Validation |

### Day 3: Skills Standardization (3-4 hours)

| # | Task | Time | Impact |
|---|------|------|--------|
| 12 | Create `bin/migrate-skill-descriptions.sh` | 45 min | Automation |
| 13 | Run migration on 92 skills | 30 min | Description quality |
| 14 | Manual review/fix top 20 skills | 1 hr | Quality assurance |
| 15 | Split `api-design-framework` (980→300 lines) | 45 min | Spec compliance |
| 16 | Split 2 other verbose skills | 30 min | Spec compliance |
| 17 | Add capabilities.json deprecation notes | 15 min | Documentation |

### Day 4: Evaluations & Testing (2 hours)

| # | Task | Time | Impact |
|---|------|------|--------|
| 18 | Create evaluation schema | 15 min | Infrastructure |
| 19 | Write evaluations for top 10 skills | 1 hr | Quality assurance |
| 20 | Create `test-description-triggers.sh` | 20 min | Validation |
| 21 | Create `test-skill-length.sh` | 15 min | Spec compliance |
| 22 | Full test suite run | 15 min | Verification |

---

## Files to Modify

### Agents (20 files)
```
agents/*.md
- Remove dead hooks section
- Add purposeful hooks (where applicable)
- Merge Auto Mode keywords into description
- Update context mode (5 agents)
```

### Skills (92 files)
```
skills/*/.claude/skills/*/SKILL.md
- Update description with trigger keywords
```

### Hooks (3 new files)
```
hooks/agent/block-writes.sh (NEW)
hooks/agent/security-command-audit.sh (NEW)
hooks/agent/migration-safety-check.sh (NEW)
```

### Tests (5 new files)
```
tests/agents/test-hook-paths.sh (NEW)
tests/agents/test-auto-mode-in-description.sh (NEW)
tests/agents/test-context-modes.sh (NEW)
tests/skills/test-description-triggers.sh (NEW)
tests/skills/test-skill-length.sh (NEW)
```

### Scripts (2 new files)
```
bin/migrate-skill-descriptions.sh (NEW)
bin/build-skill-descriptions.sh (NEW)
```

### Documentation
```
CLAUDE.md - Update capabilities.json documentation
.claude/schemas/skill-capabilities.schema.json - Add deprecation note
.claude/schemas/skill-evaluation.schema.json (NEW)
```

---

## Success Criteria

| Metric | Before | After |
|--------|--------|-------|
| Dead hook code | 3000+ tokens | 0 tokens |
| Agent hooks that execute | 0/60 | Purpose-built only |
| Skills with trigger keywords in description | ~10% | 100% |
| Skills under 500 lines | ~95% | 100% |
| Test coverage for hook paths | 0% | 100% |
| Agents with Auto Mode in body | 20 | 0 |
| Read-only agents with write guards | 0 | 5 |

---

## Rollback Plan

If issues arise:
1. All changes are in git - easy revert
2. Keep backup of current agent frontmatter
3. Test each phase independently before merging
4. Progressive rollout: fix agents first, then skills

---

## Questions Before Proceeding

1. **Agent-specific hooks**: Approve creating `hooks/agent/` with purpose-built scripts?
2. **Context mode changes**: Confirm 5 read-only agents should use `inherit`?
3. **Skills migration**: Run automated description migration, or manual review each?
4. **Verbose skills**: Approve splitting api-design-framework into 5 reference files?