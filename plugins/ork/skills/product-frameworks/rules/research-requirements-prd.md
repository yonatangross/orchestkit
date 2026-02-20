---
title: Engineer requirements with INVEST user stories and comprehensive PRD documentation
category: research
impact: HIGH
impactDescription: "Ensures proper requirement engineering with INVEST user stories and comprehensive PRD documentation"
tags: prd, user-stories, requirements, acceptance-criteria, invest
---

# Requirements Engineering & PRDs

Patterns for translating product vision into clear, actionable engineering specifications.

## User Stories

### Standard Format

```
As a [type of user],
I want [goal/desire],
so that [benefit/value].
```

### INVEST Criteria

| Criterion | Description | Example Check |
|-----------|-------------|---------------|
| **I**ndependent | Can be developed separately | No hard dependencies on other stories |
| **N**egotiable | Details can be discussed | Not a contract, a conversation starter |
| **V**aluable | Delivers user/business value | Answers "so what?" |
| **E**stimable | Can be sized by the team | Clear enough to estimate |
| **S**mall | Fits in a sprint | 1-5 days of work typically |
| **T**estable | Has clear acceptance criteria | Know when it's done |

### Good vs. Bad Stories

**Good:**
```markdown
As a sales manager,
I want to see my team's pipeline by stage,
so that I can identify bottlenecks and coach accordingly.

Acceptance Criteria:
- [ ] Shows deals grouped by stage
- [ ] Displays deal count and total value per stage
- [ ] Filters by date range (default: current quarter)
- [ ] Updates in real-time when deals move stages
```

**Bad (too vague):** `As a user, I want better reporting.`
**Bad (solution-focused):** `As a user, I want a pie chart on the dashboard.`

## Acceptance Criteria

### Given-When-Then Format (Gherkin)

```text
Scenario: Successful login with valid credentials
  Given I am on the login page
  And I have a valid account
  When I enter my email "user@example.com"
  And I enter my password "validpass123"
  And I click the "Sign In" button
  Then I should be redirected to the dashboard
  And I should see "Welcome back" message
```

## PRD Template

```markdown
# PRD: [Feature Name]

**Author:** [Name]
**Status:** Draft | In Review | Approved | Shipped

## Problem Statement
[1-2 paragraphs describing the problem we're solving]

## Goals
1. [Primary goal with measurable outcome]
2. [Secondary goal]

## Non-Goals (Out of Scope)
- [Explicitly what we're NOT doing]

## Success Metrics
| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| | | | |

## User Stories

### P0 - Must Have (MVP)
- [ ] Story 1: As a..., I want..., so that...

### P1 - Should Have
- [ ] Story 2: ...

## Dependencies
| Dependency | Owner | Status | ETA |
|------------|-------|--------|-----|

## Risks & Mitigations
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|

## Timeline
| Milestone | Date | Status |
|-----------|------|--------|
| PRD Approved | | |
| Dev Complete | | |
| Launch | | |
```

## Requirements Priority Levels

| Level | Meaning | Criteria |
|-------|---------|----------|
| **P0** | Must have for MVP | Users cannot accomplish core job without this |
| **P1** | Important | Significantly improves experience, high demand |
| **P2** | Nice to have | Enhances experience, moderate demand |
| **P3** | Future | Backlog for later consideration |

## Definition of Ready

```markdown
- [ ] User story follows standard format
- [ ] Acceptance criteria are complete and testable
- [ ] Dependencies identified and resolved
- [ ] Design artifacts available (if applicable)
- [ ] Story is estimated by the team
- [ ] Story fits within a single sprint
```

## Definition of Done

```markdown
- [ ] Code complete and reviewed
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Acceptance criteria verified
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] Product owner acceptance
```

## Non-Functional Requirements

| Category | Example Requirement |
|----------|-------------------|
| **Performance** | Page load time < 2 seconds at 95th percentile |
| **Scalability** | Support 10,000 concurrent users |
| **Availability** | 99.9% uptime |
| **Security** | All data encrypted at rest and in transit |
| **Accessibility** | WCAG 2.1 AA compliant |

**Incorrect — Vague user story without acceptance criteria:**
```markdown
As a user, I want better reporting.
```

**Correct — INVEST user story with acceptance criteria:**
```markdown
As a sales manager,
I want to see my team's pipeline by stage,
so that I can identify bottlenecks and coach accordingly.

Acceptance Criteria:
- [ ] Shows deals grouped by stage
- [ ] Displays deal count and total value per stage
- [ ] Filters by date range (default: current quarter)
- [ ] Updates in real-time when deals move stages
```
