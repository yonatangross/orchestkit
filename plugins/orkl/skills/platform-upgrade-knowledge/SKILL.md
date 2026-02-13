---
name: platform-upgrade-knowledge
description: Platform upgrade evaluation criteria and compatibility knowledge. Use when assessing model or CC version upgrades.
context: fork
version: 1.0.0
author: OrchestKit
tags: [upgrade, assessment, compatibility, platform, migration]
user-invocable: false
agent: deployment-manager
complexity: max
---

# Platform Upgrade Knowledge

Comprehensive reference for evaluating Claude model transitions, Claude Code version bumps, and OrchestKit plugin upgrades. Provides the evaluation criteria, compatibility matrices, and migration effort estimates used by the `upgrade-assessment` skill.

## Overview

Platform upgrades span three independent axes, each with distinct compatibility concerns:

```
┌─────────────────────────────────────────────────────────┐
│                   Platform Upgrade Axes                  │
├─────────────────┬─────────────────┬─────────────────────┤
│  Claude Model   │  Claude Code    │  OrchestKit Plugin  │
│  (AI backend)   │  (CLI runtime)  │  (skills/hooks/     │
│                 │                 │   agents layer)     │
├─────────────────┼─────────────────┼─────────────────────┤
│  Context window │  Hook types     │  Skill format       │
│  Output limits  │  Skill format   │  Agent format       │
│  Capabilities   │  Agent format   │  Hook source        │
│  Model ID       │  Tool registry  │  Manifest schema    │
│  Pricing        │  Permission fmt │  Build system       │
└─────────────────┴─────────────────┴─────────────────────┘
```

Each axis can be upgraded independently, but interactions between them must be validated.

## When to Use

- As reference knowledge for the `upgrade-assessment` command skill
- When planning a migration strategy across model or platform versions
- When estimating effort for a platform upgrade
- When classifying breaking changes by severity

---

## Model Capability Evolution

### Context Windows

| Model | Context Window | Max Output | Released |
|-------|---------------|------------|----------|
| Claude 3 Haiku | 200K | 4,096 | Mar 2024 |
| Claude 3.5 Sonnet | 200K | 8,192 | Jun 2024 |
| Claude 3.5 Sonnet v2 | 200K | 8,192 | Oct 2024 |
| Claude 3.5 Haiku | 200K | 8,192 | Nov 2024 |
| Claude Sonnet 4 | 200K | 64,000 | May 2025 |
| Claude Opus 4 | 200K | 32,000 | May 2025 |
| Claude Sonnet 4.5 | 1,000K | 64,000 | Sep 2025 |
| Claude Opus 4.6 | 1,000K | 128,000 | Jan 2026 |

### Feature Evolution

| Feature | First Available | Notes |
|---------|----------------|-------|
| Tool use | Claude 3 | All current models |
| Vision (image input) | Claude 3 | All current models |
| Extended thinking | Claude Sonnet 4 | Opus 4, Sonnet 4.5, Opus 4.6 |
| Computer use | Claude Sonnet 4 | Beta, not all models |
| PDF input | Claude 3.5 Sonnet v2 | All newer models |
| Token counting API | Claude 3.5 | All current models |
| Prompt caching | Claude 3.5 | Automatic on Anthropic API |
| Batch API | Claude 3.5 | All current models |
| Citations | Claude Sonnet 4 | API feature |
| Code execution | Claude Opus 4 | Sandbox environment |
| MCP (Model Context Protocol) | Claude Sonnet 4 | Via Claude Code / Desktop |
| Files API | Claude Opus 4.6 | Direct file attachment |
| Data residency (`inference_geo`) | Claude Opus 4.6 | `"global"` or `"us"` for enterprise compliance |

### Data Residency Controls (Enterprise)

Opus 4.6 supports the `inference_geo` parameter for data residency:

```json
{
  "model": "claude-opus-4-6-20260115",
  "inference_geo": "us",
  "messages": [...]
}
```

| Value | Description | Use Case |
|-------|-------------|----------|
| `"global"` | Default. Routes to nearest available region | Standard deployments |
| `"us"` | Restricts inference to US data centers | HIPAA, FedRAMP, enterprise compliance |

**Enterprise considerations:**
- Set `inference_geo` at the API client level, not per-request, for consistency
- Combine with Anthropic's SOC 2 Type II and data processing agreements
- Does not affect prompt caching behavior (cache is region-local)
- Latency may increase slightly with `"us"` for non-US users

### Model ID Mapping

When upgrading models, these are the common transitions:

| From | To | Key Changes |
|------|----|-------------|
| `claude-3-5-sonnet-20241022` | `claude-sonnet-4-20250514` | +extended thinking, +64K output, model ID format change |
| `claude-sonnet-4-20250514` | `claude-sonnet-4-5-20250916` | +1M context, same output limit |
| `claude-opus-4-20250514` | `claude-opus-4-6-20260115` | +1M context, +128K output, +files API |
| `claude-3-5-haiku-20241022` | `claude-haiku-4-20250514` | Model ID format change |

**Breaking pattern:** Model ID format changed from `claude-{version}-{variant}` to `claude-{variant}-{version}` starting with Claude 4.

---

## CC Platform Feature Mapping

### Hook Types by CC Version

| CC Version | Hook Types Available |
|------------|---------------------|
| 2.0.x | PreToolUse, PostToolUse |
| 2.1.0 | + PermissionRequest, Notification |
| 2.1.3 | + Unreachable permission detection |
| 2.1.7 | + MCP auto-deferral |
| 2.1.10 | + Stop hook, agent-scoped hooks |
| 2.1.16 | + Lifecycle hooks, skill-scoped hooks |
| 2.1.25 | + Fire-and-forget async dispatchers |
| 2.1.30 | + Memory auto-write to MEMORY.md |
| 2.1.32 | + Skill budget scaling (2% of context), prompt hooks |
| 2.1.33 | + TeammateIdle, TaskCompleted hooks, Agent Teams, agent memory frontmatter |
| 2.1.34 | Stability release, no breaking changes from 2.1.33 |

### Skill Format Changes

| CC Version | Format Change |
|------------|---------------|
| 2.0.x | Basic SKILL.md with name and description |
| 2.1.0 | + `context: fork` required |
| 2.1.6 | + Agent frontmatter format (`model`, `tools`, `skills`) |
| 2.1.10 | + `allowedTools` for command skills |
| 2.1.16 | + `agent:` field for skill-agent binding |
| 2.1.32 | + Auto-scaling token budget |

### Agent Format Changes

| CC Version | Format Change |
|------------|---------------|
| 2.1.6 | Initial agent format with frontmatter |
| 2.1.10 | + `skills:` array for auto-injection |
| 2.1.16 | + Agent-scoped hooks |
| 2.1.25 | + `subagent_type` parameter in Task tool |

---

## Breaking Change Classification

### Severity Levels

| Level | Symbol | Criteria | Required Action |
|-------|--------|----------|-----------------|
| **CRITICAL** | RED | Functionality breaks on upgrade; errors or crashes | Must fix before upgrade |
| **WARNING** | YELLOW | Degraded behavior; works but incorrectly or suboptimally | Fix in same sprint |
| **INFO** | BLUE | Documentation outdated; no functional impact | Update when convenient |

### Common Breaking Changes by Category

#### Model Upgrades

| Change | Severity | Detection Pattern | Fix |
|--------|----------|-------------------|-----|
| Hardcoded model ID | CRITICAL | `grep "claude-.*-\d"` | Update to new model ID |
| Context window assumption | WARNING | `grep "200000\|200_000"` | Update to new window size |
| Output token assumption | WARNING | `grep "max_tokens.*4096\|8192"` | Update to new output limit |
| Removed capability reliance | CRITICAL | Capability-specific code | Conditional feature check |
| Deprecated `output_format` | WARNING | `grep "output_format"` | Migrate to `output_config.format` |
| Removed response prefilling | CRITICAL | `grep -i "prefill"` | Use structured outputs or system prompt |
| Pricing assumption | INFO | Cost estimation code | Update pricing tables |

#### CC Version Upgrades

| Change | Severity | Detection Pattern | Fix |
|--------|----------|-------------------|-----|
| Removed hook type | CRITICAL | hooks.json references | Migrate to new hook type |
| Changed hook signature | CRITICAL | Hook handler functions | Update function signature |
| New required frontmatter | WARNING | Skill/agent YAML | Add required fields |
| Deprecated config field | WARNING | `.claude/settings.json` | Use replacement field |
| New default behavior | INFO | Implicit behavior change | Review and accept or override |

#### OrchestKit Upgrades

| Change | Severity | Detection Pattern | Fix |
|--------|----------|-------------------|-----|
| Removed skill | CRITICAL | Manifest references | Remove or replace |
| Renamed skill | WARNING | Skill name references | Update references |
| Changed manifest schema | WARNING | `manifests/*.json` | Update to new schema |
| Hook source reorganization | WARNING | Hook import paths | Update import paths |
| New build requirements | INFO | `scripts/build-plugins.sh` | Update build process |

---

## Migration Effort Estimation

### Effort Categories

| Category | Low (< 1 hour) | Medium (1-4 hours) | High (4+ hours) |
|----------|----------------|--------------------|-----------------|
| **Model refs** | Find-and-replace model IDs | Update conditional model logic | Rewrite capability-dependent code |
| **Hooks** | Update hook registration | Migrate hook handler signatures | Rewrite hook logic for new lifecycle |
| **Skills** | Add missing frontmatter fields | Restructure skill content | Create new skills for new capabilities |
| **Agents** | Update model field | Update tool/skill references | Rewrite agent directives |
| **Memory** | No changes needed | Update storage format | Migrate between memory tiers |
| **CI/CD** | Update version pins | Update test assertions | Rewrite pipeline stages |

### Estimation Formula

```
total_hours = sum(
  finding_count[severity] * effort_multiplier[severity]
  for severity in [CRITICAL, WARNING, INFO]
)

effort_multiplier = {
  CRITICAL: 2.0,   # Average 2 hours per critical finding
  WARNING:  0.5,   # Average 30 min per warning
  INFO:     0.1,   # Average 6 min per info item
}
```

---

## Upgrade Checklist Template

### Pre-Upgrade

- [ ] Run `/ork:upgrade-assessment` to generate readiness report
- [ ] Review all P0 (Blocker) findings
- [ ] Create migration branch
- [ ] Back up current `.claude/` configuration
- [ ] Document current environment versions

### During Upgrade

- [ ] Address P0 findings first (blockers)
- [ ] Update model references
- [ ] Update CC version (if applicable)
- [ ] Run `npm run build` to rebuild plugins
- [ ] Run `npm test` to validate structure
- [ ] Run `npm run test:security` (must pass)

### Post-Upgrade

- [ ] Run `/ork:doctor` for health validation
- [ ] Verify hook execution (check logs)
- [ ] Test user-invocable skills
- [ ] Validate memory system tiers
- [ ] Run CI pipeline end-to-end
- [ ] Address P1 findings (critical)

---

## Related Skills

- `upgrade-assessment` - Automated readiness assessment command
- `doctor` - Post-upgrade health validation
- `devops-deployment` - CI/CD pipeline patterns
- `context-optimization` - Context window and token budget management

## References

- [Scoring Rubric](references/scoring-rubric.md) - Detailed 0-10 scale for each dimension
- [Compatibility Matrix](references/compatibility-matrix.md) - Model x CC version tracking template
