---
name: prd
license: MIT
compatibility: "Claude Code 2.1.59+."
description: "Product Requirements Documents with structured 8-section templates, user stories, acceptance criteria, and value proposition validation. Use when writing PRDs, defining product requirements, creating user stories with INVEST criteria, or building go/no-go decision frameworks."
tags: [prd, requirements, user-story, acceptance-criteria, invest, value-proposition, go-no-go]
context: fork
agent: product-strategist
version: 1.0.0
author: OrchestKit
user-invocable: true
disable-model-invocation: false
complexity: medium
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# PRD — Product Requirements Document

Translate product vision and research into clear, actionable engineering specifications. Produces `PRD-[product-name].md` output files following an 8-section structure.

**Output file naming:** `PRD-[product-name].md` (e.g., `PRD-sso-invite-flow.md`)

## The 8-Section PRD Template

```markdown
# PRD: [Feature Name]

**Author:** [Name] | **Status:** Draft | In Review | Approved | Shipped | **Date:** YYYY-MM-DD

## 1. Summary
One paragraph: what we're building and why it matters now.

## 2. Contacts
| Role | Name | Responsibility |
|------|------|----------------|
| PM | | Decision owner |
| Engineering Lead | | Technical delivery |
| Design | | UX/UI |

## 3. Background
- What triggered this initiative? (data, customer request, strategic bet)
- Relevant prior work or research
- Constraints and assumptions

## 4. Objective
1. [Primary goal with measurable outcome]
2. [Secondary goal]

**Non-Goals (explicit out-of-scope):**
- [What we are NOT doing]

## 5. Market Segments
| Segment | Size | Priority | Notes |
|---------|------|----------|-------|
| | | | |

## 6. Value Propositions
| User Type | Job-to-be-Done | Pain Relieved | Gain Created |
|-----------|----------------|---------------|--------------|
| | | | |

## 7. Solution

### User Stories (P0 — Must Have)
- [ ] As a [persona], I want [goal], so that [benefit].

### User Stories (P1 — Should Have)
- [ ] ...

### Acceptance Criteria
See story-level criteria below each story.

### Dependencies
| Dependency | Owner | Status | ETA |
|------------|-------|--------|-----|

### Risks & Mitigations
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|

## 8. Release
| Milestone | Date | Status |
|-----------|------|--------|
| PRD Approved | | |
| Dev Complete | | |
| Launch | | |

**Success Metrics:**
| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
```

## User Stories

### Standard Format

```
As a [type of user],
I want [goal/desire],
so that [benefit/value].
```

### INVEST Criteria

Every story must pass all six checks before it's "ready":

| Criterion | Check |
|-----------|-------|
| **I**ndependent | No hard dependencies on other in-flight stories |
| **N**egotiable | Details are a conversation starter, not a contract |
| **V**aluable | Clearly answers "so what?" |
| **E**stimable | Team can size it without major unknowns |
| **S**mall | Completable in 1-5 days |
| **T**estable | Has explicit acceptance criteria |

**Incorrect — vague story:**
```markdown
As a user, I want better reporting.
```

**Correct — INVEST story with acceptance criteria:**
```markdown
As a sales manager,
I want to see my team's pipeline grouped by stage,
so that I can identify bottlenecks and coach accordingly.

Acceptance Criteria:
- [ ] Shows deals grouped by stage with count and total value per stage
- [ ] Filters by date range (default: current quarter)
- [ ] Updates in real-time when deals change stages
- [ ] Accessible at /pipeline for all users with the "manager" role
```

## Acceptance Criteria (Given/When/Then)

Use Gherkin format for testable criteria:

```gherkin
Scenario: Successful login with valid credentials
  Given I am on the login page
  And I have a valid account
  When I enter my email and password
  And I click "Sign In"
  Then I should be redirected to the dashboard
  And I should see a "Welcome back" message
```

## Value Proposition Canvas Integration

Before writing the solution section, complete the value canvas to ensure fit:

```
Customer Profile (right)          Value Map (left)
─────────────────────────         ─────────────────────────
Jobs-to-be-Done          ◄────    Products & Services
• Functional jobs                 • Features and capabilities
• Social jobs
• Emotional jobs

Pains                    ◄────    Pain Relievers
• Obstacles and risks             • How we eliminate friction
• Undesired outcomes

Gains                    ◄────    Gain Creators
• Required and expected           • How we create benefits
  outcomes
```

**Fit check:** Every item in the Value Map must correspond to at least one Job, Pain, or Gain. Remove features with no matching customer need.

## Go/No-Go Gate Criteria

Use stage gates before committing to build:

```markdown
## Gate 2: Solution Validation (before starting dev)
- [ ] Value proposition tested with ≥ 3 customer interviews
- [ ] Technical feasibility confirmed by engineering lead
- [ ] Competitive differentiation is clear
- [ ] Unit economics viable (projected CAC < LTV/3)

## Gate 3: Business Case (before sprint planning)
- [ ] ROI > 15% hurdle rate
- [ ] Payback period < 24 months
- [ ] Resource requirements confirmed (FTEs, infra)
- [ ] Risk mitigation plan in place
```

**Scoring thresholds:** Go ≥ 7.0 | Conditional Go 5.0–6.9 | No-Go < 5.0

## Priority Levels

| Level | Meaning | Criteria |
|-------|---------|----------|
| **P0** | Must have for MVP | Users cannot accomplish core job without this |
| **P1** | Important | Significantly improves experience, high demand |
| **P2** | Nice to have | Enhances experience, moderate demand |
| **P3** | Future | Backlog for later consideration |

## Definition of Ready / Done

**Ready (before sprint):**
```markdown
- [ ] User story follows As a/I want/So that format
- [ ] Acceptance criteria are complete and testable
- [ ] Dependencies identified and resolved
- [ ] Story is estimated by the team
- [ ] Design artifacts available (if applicable)
```

**Done (after dev):**
```markdown
- [ ] Code complete and reviewed
- [ ] Unit and integration tests passing
- [ ] Acceptance criteria verified by PM
- [ ] Documentation updated
- [ ] Deployed to staging
```

## Non-Functional Requirements

Always include NFRs in the PRD solution section:

| Category | Example |
|----------|---------|
| Performance | Page load < 2s at p95 |
| Scalability | 10,000 concurrent users |
| Availability | 99.9% uptime |
| Security | Data encrypted at rest and in transit |
| Accessibility | WCAG 2.1 AA |

## PRD JSON Output Schema

When producing structured PRD output for automated pipelines:

```json
{
  "prd": {
    "title": "SSO Invite Flow",
    "version": "1.0",
    "author": "PM Name",
    "status": "draft"
  },
  "problem_statement": "Team admins cannot invite members via SSO, blocking enterprise onboarding.",
  "scope": {
    "in": ["Email-based SSO invite", "Role assignment on first login"],
    "out": ["Custom SAML provider", "Mobile biometric auth"]
  },
  "user_stories": [
    {
      "id": "US-001",
      "persona": "Team Admin",
      "story": "As a team admin, I want to invite members via email, so that onboarding is self-service.",
      "acceptance_criteria": [
        "Invite email sent within 30 seconds",
        "Invited user can set password on first visit",
        "Admin sees pending/accepted status"
      ],
      "priority": "must-have"
    }
  ],
  "non_functional": {
    "performance": "Invite flow completes in < 2s p95",
    "security": "Invite tokens expire after 72 hours"
  }
}
```

## Rules (Load On-Demand)

- [research-requirements-prd.md](rules/research-requirements-prd.md) — INVEST user stories, PRD template, priority levels, DoR/DoD
- [strategy-value-prop.md](rules/strategy-value-prop.md) — Value proposition canvas, JTBD framework, fit assessment
- [strategy-go-no-go.md](rules/strategy-go-no-go.md) — Stage gate criteria, scoring, build/buy/partner decision matrix

## References

- [output-templates.md](references/output-templates.md) — Structured JSON output schemas for PRD, business case, and strategy artifacts
- [value-prop-canvas-guide.md](references/value-prop-canvas-guide.md) — Detailed value proposition canvas facilitation guide

## Related Skills

- `ork:user-research` — Build user understanding (personas, journey maps, interviews) before writing the PRD
- `ork:product-frameworks` — Full PM framework suite (business cases, RICE, OKRs, metrics)

---

**Version:** 1.0.0
