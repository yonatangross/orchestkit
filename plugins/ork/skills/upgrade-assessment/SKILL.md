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

Run precondition checks and environment detection. See [Detection Checks](rules/detection-checks.md) for verification scripts and expected output format.

---

### Phase 2: Research

**Tools:** `WebSearch`, `WebFetch`

Research the target versions for new capabilities and breaking changes:

1. **Model changes:** Search for target model capabilities, breaking changes, new tool support
2. **CC version changes:** Search for changelog, new hook types, skill format changes, deprecated fields
3. **OrchestKit changes:** Read CHANGELOG.md, identify new/removed/renamed skills, hook migration needs

**Research queries:**
```
"Claude {target_model} capabilities release notes"
"Claude Code {target_version} changelog breaking changes"
"Claude {target_model} vs {current_model} differences"
```

---

### Phase 3: Codebase Scan

**Tools:** `Grep`, `Glob`, `Read`

Scan the codebase for patterns affected by the upgrade. See [Codebase Scan Patterns](rules/codebase-scan-patterns.md) for grep patterns and severity classification.

---

### Phase 4: Scoring

Rate readiness 0-10 across 6 dimensions using the scoring rubric from `platform-upgrade-knowledge`. See [Scoring Rubric](references/scoring-rubric.md) for per-dimension thresholds, weights, and score interpretation.

---

### Phase 5: Recommendations

Generate prioritized action items based on Phase 3 findings and Phase 4 scores. See [Recommendation Format](references/recommendation-format.md) for priority assignment algorithm, effort estimation, and recommendation structure.

---

## Output Format

The assessment produces a structured JSON report. See [Output Format](references/output-format.md) for the full schema and example.

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
| [detection-checks](rules/detection-checks.md) | HIGH | Precondition checks, environment detection scripts |
| [codebase-scan-patterns](rules/codebase-scan-patterns.md) | HIGH | Grep patterns, severity classification |
| [knowledge-evaluation](rules/knowledge-evaluation.md) | HIGH | 6-dimension scoring rubric, severity classification |
| [knowledge-compatibility](rules/knowledge-compatibility.md) | HIGH | Version compatibility matrix, breaking change detection |

## Related Skills

- `platform-upgrade-knowledge` - Scoring rubric details and compatibility matrix
- `doctor` - Post-upgrade health validation
- `explore` - Codebase exploration for impact analysis
- `verify` - Verification of changes after migration
- `devops-deployment` - CI/CD pipeline updates

## References

- [Scoring Rubric](references/scoring-rubric.md) - Detailed dimension scoring thresholds
- [Recommendation Format](references/recommendation-format.md) - Priority assignment and effort estimation
- [Output Format](references/output-format.md) - JSON report schema and example
- See `platform-upgrade-knowledge/references/scoring-rubric.md` for additional scoring details
- See `platform-upgrade-knowledge/references/compatibility-matrix.md` for version compatibility tracking
