---
description: "Personalized setup and onboarding wizard. Use when setting up OrchestKit for a new project, configuring plugins, or generating a readiness score and improvement plan."
allowed-tools: [Read, Grep, Glob, Bash, AskUserQuestion, TaskCreate, TaskUpdate, mcp__memory__search_nodes, mcp__memory__create_entities, mcp__memory__create_relations, mcp__ork-elicit__ork_elicit]
---

# Auto-generated from skills/setup/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# OrchestKit Setup Wizard

Personalized onboarding that scans your codebase, detects your stack, recommends skills and MCPs, and generates an actionable improvement plan.

## When to Use

- First time after installing OrchestKit (`/plugin install ork`)
- Joining a new project and want OrchestKit tuned for it
- Periodically with `--rescan` to track improvement
- Enterprise users who need safe, user-scoped install confirmation

## Quick Start

```bash
/ork:setup              # Full 8-phase wizard
/ork:setup --rescan     # Re-scan after changes (skip safety phase)
/ork:setup --score-only # Just show readiness score
/ork:setup --plan-only  # Just show improvement plan
/ork:setup --channel    # Just show release channel
/ork:setup --configure  # Jump directly to Phase 3.5: project configuration wizard
```

## Argument Resolution

```python
FLAG = "$ARGUMENTS[0]"  # First token: --rescan, --score-only, --plan-only, --channel
# If no arguments, run full 8-phase wizard.
# $ARGUMENTS is the full string (CC 2.1.59 indexed access)
```

## The Nine Phases

| Phase | What | Tools Used | Output |
|-------|------|-----------|--------|
| 1. Scan | Detect languages, frameworks, infra, existing config | Glob, Grep, Read | Raw scan data |
| 2. Stack | Classify detected stack, confidence levels | — | Stack profile |
| 3. Safety | Check existing config, confirm scope (user/project) | Read, AskUserQuestion | Install confirmation |
| 3.5. Configure | Interactive project configuration wizard → writes env block to per-project settings | Read, Write, AskUserQuestion | Configured settings file |
| 4. Skills | Match stack to skills, suggest custom skills | Grep, Glob | Skill recommendations |
| 5. MCPs | Recommend MCPs based on stack and gaps | Read, Bash | MCP recommendations |
| 6. Score | Compute readiness score (0-10, 6 dimensions) | All above data | Readiness score |
| 7. Plan | Prioritized improvements with runnable commands | — | Action plan |
| 8. Keys | Install recommended keyboard shortcuts | Read, Bash, AskUserQuestion | Keybindings |


## Phase 1: Scan

Load details: `Read("${CLAUDE_SKILL_DIR}/references/scan-phase.md")` for full scan commands (20 parallel Glob probes + dependency file reads + pattern detection counts).

Scans for package manifests (package.json, pyproject.toml, go.mod, Cargo.toml, etc.), infrastructure (Docker, GitHub Actions, Terraform, K8s), and existing CC configuration. Pattern detection counts API routes, React components, models, and tests for custom skill suggestions.

## Phase 2: Stack Detection

Classify scan results into a stack profile and present to user (languages, frameworks, database, infra, testing, existing CC config).

Load `Read("${CLAUDE_SKILL_DIR}/references/stack-skill-mapping.md")` for the full stack-to-skill mapping table, MCP recommendation matrix, and custom skill suggestion patterns.

## Phase 2b: Channel Detection

Detect release channel from `manifests/ork.json` version string. Classification: `X.Y.Z` = stable, `X.Y.Z-beta.*` = beta, `X.Y.Z-alpha.*` = alpha. Display alongside stack profile. Use `--channel` flag to show only channel detection.

## Phase 3: Safety Check

Load details: `Read("${CLAUDE_SKILL_DIR}/references/safety-check.md")` for the full AskUserQuestion prompt and conflict detection logic.

Offers three install scopes: User-only (recommended, invisible to teammates), Project-wide (committed to repo), or Already installed (skip to configure). Checks for existing OrchestKit installs and conflicting plugins.

## Phase 3.5: Project Configuration Wizard

Load details: `Read("${CLAUDE_SKILL_DIR}/references/configure-wizard.md")` for the full 6-step interactive configuration flow (branch strategy, commit scope, localhost browser, perf telemetry, log verbosity, webhook telemetry) and env var reference.

> Also reachable directly via `/ork:setup --configure` — skips phases 1-3.


## Phase 4: Skill Recommendations

Present skill categories using `AskUserQuestion` with 4 focus options (Full-stack, Backend, Frontend, DevOps) with `multiSelect: true`. Load `Read("${CLAUDE_SKILL_DIR}/references/stack-skill-mapping.md")` for mapping tables and custom skill suggestions.

## Phase 5: MCP Recommendations

Check installed vs recommended MCPs by reading `.mcp.json` and `~/.claude/settings.json`. Load `Read("${CLAUDE_SKILL_DIR}/references/stack-skill-mapping.md")` for the MCP recommendation matrix. Present as toggles with install commands.

## Phase 6: Readiness Score

Compute a composite score (0-10) from 6 dimensions. Load `Read("${CLAUDE_SKILL_DIR}/references/readiness-scoring.md")` for dimension weights, score presentation template, memory integration, and improvement plan template.

## Phase 7: Improvement Plan

Generate prioritized, **runnable** recommendations in P0/P1/P2 tiers. See `readiness-scoring.md` for the template and memory persistence pattern.

## Phase 7b: CLAUDE.md Health Check

After the improvement plan, check if the user's CLAUDE.md could benefit from CC 2.1.59+ modular structure.

Load details: `Read("${CLAUDE_SKILL_DIR}/references/claude-md-health.md")` for analysis steps, thresholds, @import syntax, and `.claude/rules/` path-scoped rules.

```python
# Quick check
Bash(command="wc -l CLAUDE.md 2>/dev/null | awk '{print $1}'")
Glob(pattern=".claude/rules/*.md")
```

If CLAUDE.md > 200 lines and no `.claude/rules/` exist, recommend splitting. Show the output template from the reference doc.

## Phase 8: Keybindings

Load details: `Read("${CLAUDE_SKILL_DIR}/references/keybindings.md")` for the full keybinding prompt, default shortcuts, and merge logic.

Offers 5 recommended shortcuts (commit, verify, implement, explore, review-pr). Merges with existing `~/.claude/keybindings.json` without overwriting user-defined bindings.

## Post-Setup

> **Tip (CC 2.1.69+):** After setup completes, run `/reload-plugins` to activate all plugin changes without restarting your session.

## Phase 9: Telemetry & Webhooks

> Previously in `/ork:configure`. Now part of setup for single entry point.

Load details: `Read("${CLAUDE_SKILL_DIR}/references/telemetry-setup.md")` for the full configuration flow.

Ask user preference with AskUserQuestion:

| Mode | Events | Auth | Overhead |
|------|--------|------|----------|
| **Full streaming** | All 18 CC events via HTTP hooks | Bearer token | Near-zero |
| **Summary only** | SessionEnd + worktree events | HMAC auth | None |
| **Skip** | No telemetry | — | None |

If streaming selected:
1. Ask for webhook URL
2. Run `npm run generate:http-hooks -- <url> --write`
3. Save to `.claude/orchestration/config.json`
4. Remind about `ORCHESTKIT_HOOK_TOKEN` env var

## Phase 10: Optional Integrations

Load details: `Read("${CLAUDE_SKILL_DIR}/references/integrations.md")` for setup steps.

Covers Agentation UI annotation tool, CC version-specific settings (CC 2.1.7 turn duration, CC 2.1.20 task deletion, CC 2.1.23 spinner verbs), and monorepo worktree optimization.

### Monorepo Sparse Paths (CC 2.1.76+)

If Phase 1 scan detected a monorepo (pnpm-workspace.yaml, nx.json, lerna.json, turbo.json, or package.json workspaces), suggest configuring `worktree.sparsePaths` in `.claude/settings.json`:

```json
{
  "worktree": {
    "sparsePaths": ["src/", "packages/core/", "tests/", "scripts/"]
  }
}
```

This makes `--worktree` and agent `isolation: worktree` check out only the listed directories via git sparse-checkout — significantly faster in large monorepos.

## CLI Flags

| Flag | Behavior |
|------|----------|
| (none) | Full wizard (phases 1-10) |
| `--rescan` | Re-run scan + score, skip safety phase |
| `--configure` | Jump directly to Phase 3.5: project configuration wizard |
| `--score-only` | Show current readiness score (Phase 6 only) |
| `--plan-only` | Show improvement plan (Phase 7 only) |
| `--channel` | Show detected release channel only |
| `--telemetry` | Jump to Phase 9: telemetry/webhook setup |
| `--preset` | Apply a preset (complete/standard/lite/hooks-only/monorepo) |

## Presets (via --preset)

Apply a preset to quickly configure OrchestKit without the full wizard:

| Preset | Skills | Agents | Hooks | Best For |
|--------|--------|--------|-------|----------|
| **complete** | 91 | 31 | 96 | Full power — everything enabled |
| **standard** | 91 | 0 | 96 | Skills + hooks, no agents |
| **lite** | 10 | 0 | 96 | Essential workflow skills only |
| **hooks-only** | 0 | 0 | 96 | Just safety hooks |
| **monorepo** | 91 | 31 | 96 | Complete + monorepo workspace detection |

Load preset details: `Read("${CLAUDE_SKILL_DIR}/references/presets.md")`

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:

| File | Content |
|------|---------|
| `scan-phase.md` | Phase 1: 20 parallel Glob probes + pattern detection |
| `safety-check.md` | Phase 3: Install scope and conflict detection |
| `configure-wizard.md` | Phase 3.5: 6-step interactive project config |
| `claude-md-health.md` | Phase 7b: CLAUDE.md modular structure analysis |
| `keybindings.md` | Phase 8: Keyboard shortcut recommendations |
| `telemetry-setup.md` | Phase 9: Webhook/telemetry configuration |
| `integrations.md` | Phase 10: Agentation + CC version settings |
| `presets.md` | Preset definitions and skill/agent matrices |

## Related Skills

- `ork:doctor` — Health diagnostics (wizard uses its checks)
- `ork:configure` — Internal configuration (called by wizard phases 3.5, 9, 10)
- `ork:remember` — Knowledge persistence (wizard seeds initial patterns)
- `ork:explore` — Deep codebase analysis (wizard links for follow-up)
- `ork:help` — Skill directory (wizard surfaces relevant subset)
