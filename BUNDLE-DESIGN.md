# SkillForge Bundle Design v2

## Philosophy

**Default = Complete.** Most users want everything. Lighter tiers exist for specific use cases.

```
┌─────────────────────────────────────────────────────────────────┐
│                     DEFAULT INSTALLATION                         │
│                                                                  │
│   /plugin install @skillforge                                    │
│                    ↓                                             │
│            @skillforge/complete                                  │
│                                                                  │
│   78 skills | 20 agents | 11 commands | 92 hooks                │
│                                                                  │
│   "Everything you need for AI-assisted development"             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Alternative Tiers (for specific needs)

### Why Lighter Tiers?

| Use Case | Problem | Solution |
|----------|---------|----------|
| "Context is too long" | Complete loads too many skills | Use `standard` or `lite` |
| "Just want safety hooks" | Don't need skills/agents | Use `hooks-only` |
| "Only doing AI work" | Don't need frontend skills | Use `ai-ml` module |
| "Team guardrails only" | Want coordination, not AI | Use `team-safe` |

---

## Tier Structure

```
                    ┌─────────────────────────────────┐
                    │      @skillforge/complete       │  ← DEFAULT
                    │  78 skills, 20 agents, 92 hooks │
                    │        "Everything"             │
                    └─────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
        ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
        │   standard    │  │     lite      │  │  hooks-only   │
        │   78 skills   │  │   10 skills   │  │   0 skills    │
        │   0 agents    │  │   5 commands  │  │   92 hooks    │
        │   92 hooks    │  │   92 hooks    │  │   "Safety"    │
        │ "No agents"   │  │ "Essentials"  │  │               │
        └───────────────┘  └───────────────┘  └───────────────┘
```

---

## Detailed Tier Contents

### `@skillforge/complete` (DEFAULT)
```
EVERYTHING INCLUDED

Skills (78):
├── AI/ML (26): agent-loops, rag-retrieval, langgraph-*, embeddings, ...
├── Backend (15): fastapi-advanced, api-design-framework, database-*, ...
├── Frontend (8): react-server-components, motion-animation, i18n-*, ...
├── Testing (13): unit-testing, e2e-testing, webapp-testing, msw-*, ...
├── Security (7): owasp-top-10, auth-patterns, defense-in-depth, ...
├── DevOps (4): devops-deployment, observability-monitoring, ...
└── Planning (6): brainstorming, architecture-decision-record, ...

Agents (20):
├── Product (6): market-intelligence, product-strategist, ...
└── Technical (14): backend-system-architect, llm-integrator, ...

Commands (11):
├── /commit, /create-pr, /review-pr
├── /implement, /explore, /verify
├── /run-tests, /fix-issue, /errors
└── /brainstorm, /add-golden

Hooks (92):
├── Safety (3): git-branch-protection, file-guard, redact-secrets
├── Permission (3): auto-approve-safe-bash, auto-approve-readonly, ...
├── Lifecycle (9): session-*, coordination-*, instance-*
├── Pretool (19): input validation, file locks, context gates
├── Posttool (8): audit-logger, error-tracker, metrics
├── Skill Gates (19): coverage-check, pattern-enforcer, ...
├── Agent (12): auto-spawn, context-publisher, quality-gate, ...
├── Prompt (3): context-injector, todo-enforcer
├── Stop (6): auto-save-context, cleanup, completion-check
└── Notification (2): desktop, sound
```

---

### `@skillforge/standard`
```
ALL SKILLS, NO AGENTS

Use when: You want all skills but prefer to spawn agents manually

Skills (78): ✅ All included
Agents (0): ❌ Not included (spawn manually with Task tool)
Commands (11): ✅ All included
Hooks (92): ✅ All included

Install: /plugin install @skillforge/standard
```

---

### `@skillforge/lite`
```
ESSENTIALS ONLY

Use when: You want minimal context overhead but key productivity features

Skills (10):
├── brainstorming          - Idea exploration
├── code-review-playbook   - Review patterns
├── unit-testing           - Test patterns
├── integration-testing    - Integration patterns
├── clean-architecture     - Architecture patterns
├── api-design-framework   - API design
├── input-validation       - Security basics
├── observability-monitoring - Logging/metrics
├── github-cli             - GitHub workflows
└── ascii-visualizer       - Diagrams

Agents (0): ❌ Not included
Commands (5):
├── /commit
├── /explore
├── /errors
├── /brainstorm
└── /verify

Hooks (92): ✅ All included (safety is non-negotiable)

Install: /plugin install @skillforge/lite
```

---

### `@skillforge/hooks-only`
```
SAFETY NET ONLY

Use when: You just want guardrails, no AI skills

Skills (0): ❌ Not included
Agents (0): ❌ Not included
Commands (0): ❌ Not included
Hooks (92): ✅ All included

What you get:
├── 🔒 git-branch-protection - Block commits to main/dev
├── 🔒 file-guard - Block writes to protected paths
├── 🔒 redact-secrets - Prevent secret leaks
├── ✅ auto-approve-safe-bash - Approve safe commands
├── ✅ auto-approve-readonly - Approve read operations
├── 📊 audit-logger - Log all operations
├── 📊 error-tracker - Track errors
├── 🔄 multi-instance-* - Team coordination
└── ... (all 92 hooks)

Install: /plugin install @skillforge/hooks-only
```

---

## Category Modules (Mix & Match)

For users who want specific domains only:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CATEGORY MODULES                              │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│   ai-ml      │   backend    │   frontend   │     testing        │
│  26 skills   │  15 skills   │   8 skills   │    13 skills       │
│  3 agents    │  2 agents    │  2 agents    │    2 agents        │
├──────────────┼──────────────┼──────────────┼────────────────────┤
│  security    │   devops     │   planning   │                    │
│  7 skills    │  4 skills    │  6 skills    │                    │
│  2 agents    │  0 agents    │  6 agents    │                    │
└──────────────┴──────────────┴──────────────┴────────────────────┘

Install: /plugin install @skillforge/ai-ml @skillforge/testing
```

All modules include `hooks-only` automatically (safety is non-negotiable).

---

## Installation Commands Summary

```bash
# DEFAULT - Get everything
/plugin install @skillforge

# TIERS - For specific needs
/plugin install @skillforge/complete     # Same as default
/plugin install @skillforge/standard     # All skills, no agents
/plugin install @skillforge/lite         # 10 essential skills
/plugin install @skillforge/hooks-only   # Just safety hooks

# MODULES - Mix and match
/plugin install @skillforge/ai-ml
/plugin install @skillforge/backend
/plugin install @skillforge/frontend
/plugin install @skillforge/testing
/plugin install @skillforge/security
/plugin install @skillforge/devops
/plugin install @skillforge/planning

# COMBINE MODULES
/plugin install @skillforge/ai-ml @skillforge/backend @skillforge/testing
```

---

## Hook Categories (Always Included)

Hooks are **always included** in every tier because safety is non-negotiable.

### Critical Safety Hooks (always active)
| Hook | Purpose | Blocks? |
|------|---------|---------|
| `git-branch-protection.sh` | Prevent commits to main/dev | Yes |
| `file-guard.sh` | Prevent writes to protected paths | Yes |
| `redact-secrets.sh` | Remove secrets from output | No (transforms) |

### Productivity Hooks (always active)
| Hook | Purpose |
|------|---------|
| `auto-approve-safe-bash.sh` | Skip prompts for safe commands |
| `auto-approve-readonly.sh` | Skip prompts for read operations |
| `audit-logger.sh` | Log all tool invocations |
| `error-tracker.sh` | Track error patterns |
| `context-budget-monitor.sh` | Warn on high token usage |

### Team/Coordination Hooks (active when multiple instances)
| Hook | Purpose |
|------|---------|
| `multi-instance-init.sh` | Register instance |
| `file-lock-check.sh` | Prevent concurrent edits |
| `conflict-predictor.sh` | Warn about merge conflicts |
| `coordination-heartbeat.sh` | Keep-alive for instance |

### Quality Gate Hooks (active for relevant file types)
| Hook | Purpose |
|------|---------|
| `coverage-threshold-gate.sh` | Block if coverage drops |
| `pattern-consistency-enforcer.sh` | Enforce code patterns |
| `backend-layer-validator.sh` | Enforce clean architecture |
| `test-pattern-validator.sh` | Enforce test patterns |

---

## Summary

| Tier | Skills | Agents | Commands | Hooks | Use Case |
|------|--------|--------|----------|-------|----------|
| **complete** (default) | 78 | 20 | 11 | 92 | Everything |
| standard | 78 | 0 | 11 | 92 | Manual agent control |
| lite | 10 | 0 | 5 | 92 | Minimal overhead |
| hooks-only | 0 | 0 | 0 | 92 | Just safety |

**Default behavior:** `/plugin install @skillforge` = `@skillforge/complete`