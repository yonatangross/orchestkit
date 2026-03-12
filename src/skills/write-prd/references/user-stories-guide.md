# User Stories Guide

## Standard Format

```
As a [type of user],
I want [goal/desire],
so that [benefit/value].
```

## INVEST Criteria

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

## Definition of Ready / Done

**Ready (before sprint):**
- [ ] User story follows As a/I want/So that format
- [ ] Acceptance criteria are complete and testable
- [ ] Dependencies identified and resolved
- [ ] Story is estimated by the team
- [ ] Design artifacts available (if applicable)

**Done (after dev):**
- [ ] Code complete and reviewed
- [ ] Unit and integration tests passing
- [ ] Acceptance criteria verified by PM
- [ ] Documentation updated
- [ ] Deployed to staging
