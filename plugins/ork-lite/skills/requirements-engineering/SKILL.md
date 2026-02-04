---
name: requirements-engineering
description: User stories, acceptance criteria, PRDs, and requirements documentation patterns. Use when translating product vision to engineering specs, writing user stories, or creating requirements documents.
context: fork
agent: requirements-translator
version: 1.0.0
tags: [product, requirements, user-stories, prd, acceptance-criteria, agile, 2026]
author: OrchestKit
user-invocable: false
---

# Requirements Engineering

Patterns for translating product vision into clear, actionable engineering specifications.

## User Stories

### Standard Format

```
As a [type of user],
I want [goal/desire],
so that [benefit/value].
```

### INVEST Criteria

Good user stories are:

| Criterion | Description | Example Check |
|-----------|-------------|---------------|
| **I**ndependent | Can be developed separately | No hard dependencies on other stories |
| **N**egotiable | Details can be discussed | Not a contract, a conversation starter |
| **V**aluable | Delivers user/business value | Answers "so what?" |
| **E**stimable | Can be sized by the team | Clear enough to estimate |
| **S**mall | Fits in a sprint | 1-5 days of work typically |
| **T**estable | Has clear acceptance criteria | Know when it's done |

### Story Examples

**Good:**
```markdown
As a sales manager,
I want to see my team's pipeline by stage,
so that I can identify bottlenecks and coach accordingly.

Acceptance Criteria:
- [ ] Shows deals grouped by stage (Lead, Qualified, Proposal, Negotiation, Closed)
- [ ] Displays deal count and total value per stage
- [ ] Filters by date range (default: current quarter)
- [ ] Updates in real-time when deals move stages
```

**Bad (too vague):**
```markdown
As a user, I want better reporting.
```

**Bad (solution-focused):**
```markdown
As a user, I want a pie chart on the dashboard.
```

## Acceptance Criteria

### Given-When-Then Format (Gherkin)

```gherkin
Feature: User Login

Scenario: Successful login with valid credentials
  Given I am on the login page
  And I have a valid account
  When I enter my email "user@example.com"
  And I enter my password "validpass123"
  And I click the "Sign In" button
  Then I should be redirected to the dashboard
  And I should see "Welcome back" message

Scenario: Failed login with invalid password
  Given I am on the login page
  When I enter my email "user@example.com"
  And I enter my password "wrongpassword"
  And I click the "Sign In" button
  Then I should see "Invalid credentials" error
  And I should remain on the login page
```

### Checklist Format

```markdown
## Acceptance Criteria: Password Reset

### Functional
- [ ] User can request reset via email
- [ ] Reset link expires after 24 hours
- [ ] Reset link is single-use
- [ ] New password must meet complexity requirements
- [ ] User receives confirmation email after reset

### Edge Cases
- [ ] Handles non-existent email gracefully (no user enumeration)
- [ ] Rate limits requests (max 3 per hour per email)
- [ ] Works with SSO-enabled accounts (shows appropriate message)

### Non-Functional
- [ ] Reset email sent within 30 seconds
- [ ] Page loads in < 2 seconds
- [ ] Accessible (WCAG 2.1 AA)
```

## Product Requirements Document (PRD)

### PRD Template

```markdown
# PRD: [Feature Name]

**Author:** [Name]
**Last Updated:** [Date]
**Status:** Draft | In Review | Approved | Shipped

---

## Overview

### Problem Statement
[1-2 paragraphs describing the problem we're solving]

### Goals
1. [Primary goal with measurable outcome]
2. [Secondary goal]
3. [Secondary goal]

### Non-Goals (Out of Scope)
- [Explicitly what we're NOT doing]
- [Feature for future consideration]

### Success Metrics
| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| | | | |

---

## User Stories

### P0 - Must Have (MVP)
- [ ] Story 1: As a..., I want..., so that...
- [ ] Story 2: ...

### P1 - Should Have
- [ ] Story 3: ...

### P2 - Nice to Have
- [ ] Story 4: ...

---

## Design

### User Flow
[Link to Figma/diagrams or embed]

### Wireframes
[Visual mockups]

### Technical Design
[Link to technical spec or high-level architecture]

---

## Dependencies

| Dependency | Owner | Status | ETA |
|------------|-------|--------|-----|
| API endpoint | Backend | In Progress | Week 2 |
| Design assets | Design | Complete | - |

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| | | | |

---

## Timeline

| Milestone | Date | Status |
|-----------|------|--------|
| PRD Approved | | |
| Design Complete | | |
| Dev Complete | | |
| QA Complete | | |
| Launch | | |

---

## Open Questions
1. [Question that needs resolution]
2. [Decision pending stakeholder input]

---

## Appendix
- [Link to research]
- [Link to competitive analysis]
- [Link to technical RFC]
```

## Requirements Prioritization

### Priority Levels

| Level | Meaning | Criteria |
|-------|---------|----------|
| **P0** | Must have for MVP | Users cannot accomplish core job without this |
| **P1** | Important | Significantly improves experience, high demand |
| **P2** | Nice to have | Enhances experience, moderate demand |
| **P3** | Future | Backlog for later consideration |

### Definition of Ready

Before a story enters a sprint:

```markdown
## Definition of Ready Checklist

- [ ] User story follows standard format
- [ ] Acceptance criteria are complete and testable
- [ ] Dependencies identified and resolved (or planned)
- [ ] Design artifacts available (if applicable)
- [ ] Story is estimated by the team
- [ ] Story fits within a single sprint
- [ ] Product owner available for questions
```

### Definition of Done

Before a story is considered complete:

```markdown
## Definition of Done Checklist

- [ ] Code complete and reviewed
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Acceptance criteria verified
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] QA sign-off received
- [ ] Product owner acceptance
```

## Functional vs. Non-Functional Requirements

### Functional Requirements
What the system should do.

```markdown
- FR1: System shall allow users to create new accounts
- FR2: System shall send email notifications for new messages
- FR3: System shall support export to CSV and PDF formats
```

### Non-Functional Requirements (NFRs)

| Category | Example Requirement |
|----------|-------------------|
| **Performance** | Page load time < 2 seconds at 95th percentile |
| **Scalability** | Support 10,000 concurrent users |
| **Availability** | 99.9% uptime (8.76 hours downtime/year) |
| **Security** | All data encrypted at rest and in transit |
| **Accessibility** | WCAG 2.1 AA compliant |
| **Localization** | Support English, Spanish, French |
| **Compliance** | GDPR and SOC 2 Type II compliant |

## 2026 Best Practices

- **Living documents**: PRDs evolve—link to retrospective notes
- **AI-assisted**: Use AI to draft initial requirements, human review for accuracy
- **Hybrid approach**: Combine concise PRD with evolving user stories
- **Measurable success**: If you can't define success metrics, don't write the PRD yet
- **Reduce rework**: Effective requirements eliminate 50-80% of defects (CMU SEI study)

## Common Pitfalls

| Pitfall | Mitigation |
|---------|------------|
| Solution masquerading as requirement | Focus on "what" not "how" |
| Missing edge cases | Include negative scenarios in AC |
| Untestable criteria | Use specific, measurable terms |
| Scope creep | Maintain explicit out-of-scope section |
| Stale documents | Set review cadence, archive old versions |

## Related Skills

- `product-strategy-frameworks` - Strategic context for requirements
- `prioritization-frameworks` - Prioritizing the backlog
- `user-research-methods` - Research that informs requirements

## References

- [PRD Template](references/prd-template.md)
- [User Story Workshop Guide](references/user-story-workshop.md)

**Version:** 1.0.0 (January 2026)
