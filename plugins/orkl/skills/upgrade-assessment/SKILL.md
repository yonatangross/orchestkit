---
name: upgrade-assessment
license: MIT
compatibility: "Claude Code 2.1.34+. Requires network access."
description: "Assess platform upgrade readiness for Claude model and CC version changes. Use when evaluating upgrades."
argument-hint: "[--json]"
context: fork
version: 1.0.0
author: OrchestKit
tags: [upgrade, assessment, platform, compatibility, migration]
user-invocable: true
allowed-tools: [AskUserQuestion, Bash, Read, Grep, Glob, Task, WebSearch, WebFetch]
skills: [platform-upgrade-knowledge, explore, verify, remember, memory]
complexity: max
metadata:
  category: document-asset-creation
---

# Upgrade Assessment

Evaluate platform upgrade readiness for Claude model transitions, Claude Code version bumps, and OrchestKit plugin updates. Produces a structured JSON assessment report with a 0-10 readiness score across 6 dimensions.

## When to Use

- Before upgrading the Claude model (e.g., Sonnet 4 to Opus 4.6)
- Before upgrading Claude Code to a new major/minor version
- Before upgrading OrchestKit to a new major version
- When evaluating whether a team environment is ready for a platform change
- As part of release planning for model or platform migrations

## Quick Start

```bash
/ork:upgrade-assessment           # Interactive assessment
/ork:upgrade-assessment --json    # Machine-readable output
```

---

## 6-Phase Workflow

### Phase 0: Scope Definition

**Tool:** `AskUserQuestion`

Determine the assessment scope before scanning. Ask the user:

> What type of upgrade are you assessing?
> 1. **Full platform** - Model + CC version + OrchestKit (comprehensive)
> 2. **Model only** - Switching Claude model (e.g., Sonnet 4.5 to Opus 4.6)
> 3. **CC version only** - Claude Code version bump (e.g., 2.1.32 to 2.1.33)
> 4. **OrchestKit only** - Plugin version upgrade (e.g., 5.x to 6.x)

Record the scope and target versions. If the user does not specify target versions, research the latest available in Phase 2.

---

### Phase 1: Detection

**Tools:** `Bash`, `Read`, `Grep`, `Glob`

#### Precondition Checks

Before scanning, verify the environment is assessable:

```bash
# Verify we're in an OrchestKit project
[ -f CLAUDE.md ] || { echo "ERROR: No CLAUDE.md found — not an OrchestKit project"; exit 1; }
[ -d src/skills ] || { echo "ERROR: No src/skills/ directory"; exit 1; }
[ -d src/agents ] || { echo "ERROR: No src/agents/ directory"; exit 1; }
[ -f src/hooks/hooks.json ] || { echo "WARNING: No hooks.json — hook assessment will be skipped"; }
```

If any required directory is missing, abort with a clear error. If optional components (hooks) are missing, continue with reduced scope and note it in the report.

#### Environment Detection

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

**Output:** Environment snapshot including:
- Current model ID (e.g., `claude-sonnet-4-5`)
- Current CC version (e.g., `2.1.33`)
- Current OrchestKit version (e.g., `6.0.0`)
- Hook count and bundle count
- Skill count and agent count

---

### Phase 2: Research

**Tools:** `WebSearch`, `WebFetch`

Research the target versions for new capabilities and breaking changes:

1. **Model changes:**
   - Search for the target model's capabilities (context window, output limits, new features)
   - Search for breaking changes or deprecations from the previous model
   - Check for new tool support or changed behavior

2. **CC version changes:**
   - Search for Claude Code changelog or release notes
   - Identify new hook types, skill format changes, or agent format changes
   - Check for deprecated configuration fields

3. **OrchestKit changes:**
   - Read CHANGELOG.md for the target version
   - Identify new skills, removed skills, or renamed skills
   - Check for hook migration requirements

**Research queries:**
```
"Claude {target_model} capabilities release notes"
"Claude Code {target_version} changelog breaking changes"
"Claude {target_model} vs {current_model} differences"
```

---

### Phase 3: Codebase Scan

**Tools:** `Grep`, `Glob`, `Read`

Scan the codebase for patterns affected by the upgrade:

```bash
# 1. Model references (hardcoded model IDs)
grep -r "claude-opus-4\b\|claude-sonnet-4\b\|claude-haiku-3\b" src/ --include="*.md" --include="*.ts" --include="*.json"

# 2. Deprecated API patterns
grep -r "max_tokens_to_sample\|stop_sequences\|model.*claude-2" src/ --include="*.ts" --include="*.py"

# 3. CC version-gated features
grep -r "CC 2\.1\.\|claude-code.*2\.1\." src/ --include="*.md"

# 4. Hook compatibility (check for removed or renamed hook types)
grep -r "PreToolUse\|PostToolUse\|PermissionRequest\|Stop\|Notification" src/hooks/ --include="*.ts" --include="*.json"

# 5. Context window assumptions
grep -r "200000\|200_000\|128000\|128_000\|context.*window\|max_context" src/ --include="*.ts" --include="*.md" --include="*.py"

# 6. Output token assumptions
grep -r "max_tokens.*4096\|max_tokens.*8192\|max_output\|output.*limit" src/ --include="*.ts" --include="*.py"
```

**Classify findings:**
- **CRITICAL**: Hardcoded model IDs, removed API fields, breaking hook changes
- **WARNING**: Outdated context window assumptions, deprecated patterns
- **INFO**: Version references in documentation, optional feature flags

---

### Phase 4: Scoring

**Tools:** Internal assessment logic

Rate readiness 0-10 across 6 dimensions using the scoring rubric from `platform-upgrade-knowledge`.

#### Scoring Rubric Summary

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| **Model Compatibility** | 0.25 | Hardcoded model refs, capability assumptions, output limit assumptions |
| **Hook Compatibility** | 0.20 | Hook type changes, async pattern changes, lifecycle changes |
| **Skill Coverage** | 0.15 | Skill format changes, deprecated skills, new required skills |
| **Agent Readiness** | 0.15 | Agent format changes, model field validity, tool availability |
| **Memory Architecture** | 0.10 | Memory tier changes, storage format changes, migration needs |
| **CI/CD Pipeline** | 0.15 | Test compatibility, build system changes, deployment config |

#### Score Interpretation

| Range | Label | Meaning |
|-------|-------|---------|
| 9-10 | Ready | Upgrade with confidence, minimal changes needed |
| 7-8 | Low Risk | Minor adjustments required, safe to proceed |
| 5-6 | Moderate Risk | Several changes needed, plan a migration sprint |
| 3-4 | High Risk | Significant rework required, thorough testing needed |
| 1-2 | Critical Risk | Major incompatibilities, consider phased migration |
| 0 | Blocked | Cannot upgrade without fundamental changes |

#### Weighted Score Calculation

```
overall_score = sum(dimension_score * weight for each dimension)
```

#### Per-Dimension Scoring Thresholds

Score each dimension 0-10 based on Phase 3 findings:

**Model Compatibility (weight: 0.25)**
- 10: No hardcoded model IDs, no capability assumptions
- 8: Documentation-only model references (non-functional)
- 6: 1-3 hardcoded model IDs in functional code
- 4: Output token limits or context window hardcoded
- 2: Model-specific API patterns (e.g., prefilling for Claude, function calling format)
- 0: Core logic depends on model-specific behavior

**Hook Compatibility (weight: 0.20)**
- 10: All hooks use current event types and async patterns
- 8: Minor deprecation warnings, no functional impact
- 6: 1-3 hooks use deprecated event types
- 4: Hook input/output schema changed
- 2: Hook lifecycle order changed
- 0: Hook system replaced or fundamentally restructured

**Skill Coverage (weight: 0.15)**
- 10: All skills use current frontmatter format, no stale references
- 8: Minor version references outdated in skill content
- 6: 1-5 skills reference deprecated features or removed capabilities
- 4: Skill frontmatter schema changed (new required fields)
- 2: Skill loading mechanism changed
- 0: Skill format incompatible

**Agent Readiness (weight: 0.15)**
- 10: All agents use valid model aliases, tools, and frontmatter
- 8: 1-2 agents reference removed tools or deprecated fields
- 6: Agent model field values changed meaning
- 4: Agent frontmatter schema requires migration
- 2: Agent tool availability significantly changed
- 0: Agent system incompatible

**Memory Architecture (weight: 0.10)**
- 10: Memory tiers unchanged, storage format stable
- 8: New optional memory tier available
- 6: Memory storage format changed (migration available)
- 4: Memory tier behavior changed (e.g., scope semantics)
- 2: Memory migration required with data transformation
- 0: Memory system replaced

**CI/CD Pipeline (weight: 0.15)**
- 10: All tests pass, build system unchanged
- 8: Minor test assertion updates needed
- 6: Test framework or runner version update needed
- 4: Build configuration changes required
- 2: CI pipeline restructure needed
- 0: Build system incompatible

---

### Phase 5: Recommendations

**Tools:** Assessment analysis

Generate prioritized action items based on Phase 3 findings and Phase 4 scores.

#### Priority Assignment Algorithm

Map dimension scores to priority levels:

```
For each finding from Phase 3:
  dimension_score = Phase 4 score for the finding's dimension

  if dimension_score <= 2:  priority = "P0"  # Blocker
  if dimension_score <= 4:  priority = "P1"  # Critical
  if dimension_score <= 6:  priority = "P2"  # Important
  if dimension_score <= 8:  priority = "P3"  # Nice-to-Have
  if dimension_score > 8:   # No action needed
```

#### Priority Levels

| Priority | Criteria | Timeline |
|----------|----------|----------|
| **P0 - Blocker** | Score 0-2 in any dimension; will break on upgrade | Before upgrade |
| **P1 - Critical** | Score 3-4; degraded functionality post-upgrade | Same sprint |
| **P2 - Important** | Score 5-6; works but suboptimal | Next sprint |
| **P3 - Nice-to-Have** | Score 7-8; minor improvements available | Backlog |

#### Effort Estimation

```
effort = "low"     # Single file, < 5 lines changed
effort = "medium"  # 2-5 files, or schema migration
effort = "high"    # 6+ files, or architectural change
```

#### Recommendation Format

Each recommendation includes:
1. **What**: Description of the change needed
2. **Why**: Impact if not addressed
3. **How**: Specific steps or code changes
4. **Effort**: Low (< 1 hour), Medium (1-4 hours), High (4+ hours)
5. **Files**: List of affected files

---

## Output Format

The assessment produces a structured JSON report:

```json
{
  "assessment": {
    "id": "upgrade-assessment-{timestamp}",
    "scope": "full|model-only|cc-only|ork-only",
    "timestamp": "2026-02-06T12:00:00Z"
  },
  "environment": {
    "current": {
      "model": "claude-sonnet-4-5",
      "ccVersion": "2.1.32",
      "orkVersion": "6.0.0",
      "hooks": 121,
      "skills": 199,
      "agents": 36
    },
    "target": {
      "model": "claude-opus-4-6",
      "ccVersion": "2.1.33",
      "orkVersion": "6.1.0"
    }
  },
  "scores": {
    "overall": 7.4,
    "dimensions": {
      "modelCompatibility": { "score": 8, "weight": 0.25, "weighted": 2.0 },
      "hookCompatibility": { "score": 9, "weight": 0.20, "weighted": 1.8 },
      "skillCoverage": { "score": 7, "weight": 0.15, "weighted": 1.05 },
      "agentReadiness": { "score": 7, "weight": 0.15, "weighted": 1.05 },
      "memoryArchitecture": { "score": 6, "weight": 0.10, "weighted": 0.6 },
      "cicdPipeline": { "score": 6, "weight": 0.15, "weighted": 0.9 }
    }
  },
  "findings": [
    {
      "severity": "CRITICAL",
      "dimension": "modelCompatibility",
      "description": "Hardcoded model ID 'claude-sonnet-4' in 3 agent files",
      "files": ["src/agents/code-reviewer.md", "src/agents/architect.md"],
      "recommendation": "Update model field to 'claude-opus-4-6' or use 'sonnet' alias"
    },
    {
      "severity": "WARNING",
      "dimension": "skillCoverage",
      "description": "Context window references assume 200K tokens, Opus 4.6 supports 1M",
      "files": ["src/skills/context-engineering/SKILL.md"],
      "recommendation": "Update token budget calculations for 1M context window"
    }
  ],
  "recommendations": [
    {
      "priority": "P0",
      "action": "Update hardcoded model references",
      "effort": "low",
      "files": ["src/agents/*.md"],
      "steps": [
        "Grep for 'claude-sonnet-4' and 'claude-opus-4' in src/",
        "Replace with target model ID or use alias",
        "Run npm run test:agents to validate"
      ]
    },
    {
      "priority": "P2",
      "action": "Update context budget calculations",
      "effort": "medium",
      "files": ["src/skills/context-engineering/SKILL.md"],
      "steps": [
        "Update MAX_CONTEXT values for new model",
        "Adjust compression triggers if context window changed",
        "Update documentation examples"
      ]
    }
  ],
  "summary": {
    "readiness": "Low Risk",
    "overallScore": 7.4,
    "blockers": 0,
    "criticalItems": 1,
    "totalFindings": 5,
    "estimatedEffort": "4-6 hours"
  }
}
```

---

## Execution Notes

### For Model-Only Upgrades
Focus on Phases 1, 2, and 3. Key areas:
- Agent `model:` fields
- Context window / output token assumptions
- Capability-dependent skill content (e.g., vision, audio)

### For CC Version Upgrades
Focus on hook compatibility and skill format:
- Hook type registry changes
- Skill frontmatter field additions/removals
- Permission rule format changes
- New built-in tools or removed tools

### For OrchestKit Upgrades
Focus on plugin structure:
- Manifest schema changes
- Build system changes
- Skill/agent rename or removal
- Hook source reorganization

---

## Rules Quick Reference

| Rule | Impact | What It Covers |
|------|--------|----------------|
| [knowledge-evaluation](rules/knowledge-evaluation.md) | HIGH | 6-dimension scoring rubric, severity classification |
| [knowledge-compatibility](rules/knowledge-compatibility.md) | HIGH | Version compatibility matrix, breaking change detection |

## Related Skills

- `platform-upgrade-knowledge` - Scoring rubric details and compatibility matrix
- `doctor` - Post-upgrade health validation
- `explore` - Codebase exploration for impact analysis
- `verify` - Verification of changes after migration
- `devops-deployment` - CI/CD pipeline updates

## References

- See `platform-upgrade-knowledge/references/scoring-rubric.md` for detailed dimension scoring
- See `platform-upgrade-knowledge/references/compatibility-matrix.md` for version compatibility tracking
