# PRD Template (8 Sections)

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

## 6. Value Propositions
| User Type | Job-to-be-Done | Pain Relieved | Gain Created |
|-----------|----------------|---------------|--------------|

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

**Success Metrics:**
| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
```

## Priority Levels

| Level | Meaning | Criteria |
|-------|---------|----------|
| **P0** | Must have for MVP | Users cannot accomplish core job without this |
| **P1** | Important | Significantly improves experience, high demand |
| **P2** | Nice to have | Enhances experience, moderate demand |
| **P3** | Future | Backlog for later consideration |

## Non-Functional Requirements

Always include NFRs in the solution section:

| Category | Example |
|----------|---------|
| Performance | Page load < 2s at p95 |
| Scalability | 10,000 concurrent users |
| Availability | 99.9% uptime |
| Security | Data encrypted at rest and in transit |
| Accessibility | WCAG 2.1 AA |
