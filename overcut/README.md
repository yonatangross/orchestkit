# OrchestKit × Overcut.ai Integration

Integration plan for using Overcut.ai's autonomous AI agents to test, review, and triage OrchestKit.

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Overcut Dashboard  │     │   GitHub (orchestkit) │     │    Results       │
│                      │     │                       │     │                  │
│  ┌────────────────┐  │     │  .github/workflows/   │     │  PR comments     │
│  │ Use Case 1:    │──┼──▶──│  orchestkit-eval.yml  │     │  Issue comments  │
│  │ PR Test Runner │  │     │                       │──▶──│  GHA artifacts   │
│  ├────────────────┤  │     │  overcut/             │     │  Overcut logs    │
│  │ Use Case 2:    │──┼──▶──│  ├─ instructions/     │     │                  │
│  │ Smart Review   │  │     │  │  ├─ quality.md     │     └─────────────────┘
│  ├────────────────┤  │     │  │  ├─ security.md    │
│  │ Use Case 3:    │──┼──▶──│  │  ├─ test-eng.md   │
│  │ Full Eval      │  │     │  │  └─ triage-pm.md  │
│  ├────────────────┤  │     │  └─ use-cases/        │
│  │ Use Case 4:    │  │     │     ├─ pr-test-runner/│
│  │ Issue Triage   │  │     │     ├─ smart-review/  │
│  └────────────────┘  │     │     ├─ full-eval/     │
│                      │     │     └─ issue-triage/  │
│  Agent Roles:        │     │                       │
│  ├─ quality-reviewer │     │  scripts/run-eval.sh  │
│  ├─ security-auditor │     │                       │
│  ├─ test-engineer    │     └───────────────────────┘
│  └─ triage-pm        │
└──────────────────────┘
```

## Prerequisites

- [x] GitHub integration connected (yonatangross)
- [x] orchestkit repo added (Code + Tickets)
- [x] API token created and saved in 1Password (HQ-Dev vault)
- [ ] ANTHROPIC_API_KEY added to GitHub Secrets (for GHA eval workflow)

## Agent Roles

Create these 4 custom agents in **Overcut → Agent Roles → Add Agent**:

| Agent Name | Base Type | Instructions File |
|------------|-----------|-------------------|
| `orchestkit-quality-reviewer` | Code Reviewer | [`instructions/quality-reviewer.md`](instructions/quality-reviewer.md) |
| `orchestkit-security-auditor` | Code Reviewer | [`instructions/security-auditor.md`](instructions/security-auditor.md) |
| `orchestkit-test-engineer` | Senior Developer | [`instructions/test-engineer.md`](instructions/test-engineer.md) |
| `orchestkit-triage-pm` | Product Manager | [`instructions/triage-pm.md`](instructions/triage-pm.md) |

For each: copy the contents of the instructions file into the "Additional Instructions" field.

## Use Cases

### 1. PR Test Runner

**File:** [`use-cases/pr-test-runner/workflow.json`](use-cases/pr-test-runner/workflow.json)

| Property | Value |
|----------|-------|
| Trigger | PR opened/updated on `src/hooks/**`, `src/skills/**`, `src/agents/**`, `manifests/**` |
| Agents | test-engineer → quality-reviewer |
| Flow | git.clone → npm install/build/test/typecheck → post PR comment |
| Timeout | 10 min |
| Budget | ~3 executions/month |

### 2. Smart Code Review

**File:** [`use-cases/smart-review/workflow.json`](use-cases/smart-review/workflow.json)

| Property | Value |
|----------|-------|
| Trigger | PR opened + manual `/review` command |
| Agents | quality-reviewer + security-auditor (parallel) → verdict |
| Flow | git.clone → quality score (7 dimensions) + security audit (OWASP) → combined verdict |
| Blocking | Composite < 6.0 or Security < 7.0 or any CRITICAL finding |
| Timeout | 15 min |
| Budget | ~3 executions/month |

**Scoring dimensions:** Correctness (15%), Maintainability (15%), Performance (12%), Security (20%), Scalability (10%), Testability (13%), Compliance (15%).

### 3. Full Eval Pipeline

**File:** [`use-cases/full-eval/workflow.json`](use-cases/full-eval/workflow.json)

| Property | Value |
|----------|-------|
| Trigger | Weekly cron (Sunday midnight IST) + manual `/eval` command |
| Agents | test-engineer |
| Flow | git.clone → trigger GHA `orchestkit-eval.yml` → wait → analyze results → post regression report |
| Timeout | 30 min |
| Budget | ~2 executions/month |

**GHA workflow runs:** unit tests, security tests, typecheck, skill/agent/manifest validation, and (optionally) CC-based skill eval with `claude -p --bare`.

### 4. Issue Auto-Triage

**File:** [`use-cases/issue-triage/workflow.json`](use-cases/issue-triage/workflow.json)

| Property | Value |
|----------|-------|
| Trigger | Issue opened on orchestkit |
| Agents | triage-pm |
| Flow | Read issue → assess complexity (1-5) → suggest labels + milestone → draft implementation → post comment |
| Timeout | 5 min |
| Budget | ~2 executions/month |

## Budget Allocation (100 executions/month — promo until Jun 30, 2026)

Free plan with promotional grant: **100 Workflow Executions + 400 Execution Credits per month**.
Resets monthly. Promo expires Jun 30, 2026 — plan for 100/month through June, then reassess.

| Use Case | Monthly Budget | Trigger | Notes |
|----------|---------------|---------|-------|
| PR Test Runner | ~25 | Every PR touching `src/` | No filtering — run on all PRs |
| Smart Code Review | ~25 | Every PR | Full quality + security on all PRs |
| Full Eval Pipeline | 4 | Weekly Sunday cron | Every week, not bi-weekly |
| Issue Auto-Triage | ~20 | Every new issue | No filtering — triage all issues |
| Manual `/review` | ~10 | On-demand slash command | Ad-hoc deep review requests |
| Manual `/eval` | ~6 | On-demand slash command | Ad-hoc eval runs |
| Buffer | ~10 | — | Headroom for spikes |
| **Total** | **~100** | | |

After promo (Jul 2026+): free tier drops to 10 executions/month. Prioritize Full Eval (4) + Smart Review on hooks PRs (3) + Issue Triage (3).

## Setup Checklist

### In Overcut Dashboard (~65 min)

1. [ ] **Agent Roles**: Create 4 agents with instructions from `instructions/` (20 min)
2. [ ] **Use Case 1**: Import `pr-test-runner/workflow.json`, map agents (10 min)
3. [ ] **Use Case 2**: Import `smart-review/workflow.json`, map agents (10 min)
4. [ ] **Use Case 3**: Import `full-eval/workflow.json`, map agents (10 min)
5. [ ] **Use Case 4**: Import `issue-triage/workflow.json`, map agents (10 min)
6. [ ] **Context Map**: Upload CLAUDE.md as repo context (5 min)

### In GitHub (~15 min)

7. [ ] **Secret**: Add `ANTHROPIC_API_KEY` to repo secrets (2 min)
8. [ ] **Verify GHA**: Manually trigger `orchestkit-eval.yml` workflow (5 min)
9. [ ] **Verify eval script**: `chmod +x scripts/run-eval.sh && scripts/run-eval.sh --scope full` (5 min)

### Verification (~20 min)

10. [ ] Open a test PR → verify Use Case 1 fires → check PR comment
11. [ ] Open test PR → verify Use Case 2 review appears with scores
12. [ ] Run `/eval` manually → verify Use Case 3 triggers GHA → check results
13. [ ] Create test issue → verify Use Case 4 triage comment appears

## Files in This Directory

```
overcut/
├── README.md                          # This file
├── instructions/
│   ├── quality-reviewer.md            # Quality review agent instructions
│   ├── security-auditor.md            # Security audit agent instructions
│   ├── test-engineer.md               # Test runner agent instructions
│   └── triage-pm.md                   # Issue triage agent instructions
└── use-cases/
    ├── pr-test-runner/
    │   └── workflow.json              # PR test runner playbook
    ├── smart-review/
    │   └── workflow.json              # Smart code review playbook
    ├── full-eval/
    │   └── workflow.json              # Full eval pipeline playbook
    └── issue-triage/
        └── workflow.json              # Issue auto-triage playbook
```

## Related

- **GHA workflow**: [`.github/workflows/orchestkit-eval.yml`](../.github/workflows/orchestkit-eval.yml)
- **Eval script**: [`scripts/run-eval.sh`](../scripts/run-eval.sh)
- **Overcut docs**: [docs.overcut.ai](https://docs.overcut.ai)
- **Overcut playbooks format**: [github.com/overcut-ai/overcut-playbooks](https://github.com/overcut-ai/overcut-playbooks)
- **API token**: 1Password → HQ-Dev → "Overcut.ai API Token (orchestkit-dev)"
