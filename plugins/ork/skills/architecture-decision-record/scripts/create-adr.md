---
name: create-adr
description: Create an Architecture Decision Record with auto-filled context. Use when documenting architectural decisions.
user-invocable: true
argument-hint: [number] [title]
---

Create ADR $ARGUMENTS

## Auto-Filled Context

- **Date**: !`date +%Y-%m-%d`
- **Author**: !`git config user.name || echo "Unknown"`
- **Next ADR Number**: !`ls docs/adr/*.md 2>/dev/null | grep -oE 'ADR-[0-9]+' | sort -V | tail -1 | sed 's/ADR-//' | awk '{printf "%04d", $1+1}' || echo "0001"`
- **Total ADRs**: !`ls docs/adr/*.md 2>/dev/null | wc -l | tr -d ' ' || echo "0"`
- **Current Branch**: !`git branch --show-current || echo "main"`

## ADR Template

# ADR-$ARGUMENTS: [Decision Title]

**Status**: Proposed | Accepted | Superseded | Deprecated | Rejected

**Date**: !`date +%Y-%m-%d`

**Authors**: !`git config user.name || echo "[Your Name(s)]"`

**Supersedes**: [ADR-####] (if applicable)

**Superseded by**: [ADR-####] (if applicable)

---

## Context

[Describe the problem or opportunity. What forces are at play? What constraints exist?]

**Problem Statement:**
[Clear description of the issue or opportunity]

**Current Situation:**
[What is the state of the system today?]

**Requirements:**
- [Business requirement 1]
- [Technical requirement 2]
- [Stakeholder requirement 3]

**Constraints:**
- [Time/budget/technology constraint 1]
- [Team/skill constraint 2]
- [Compliance/security constraint 3]

**Forces:**
- [Conflicting concern 1]
- [Conflicting concern 2]

---

## Decision

[Describe the decision clearly and specifically. What are you choosing to do?]

**We will:** [Clear statement of the decision]

**Technology/Approach:**
- [Component/technology 1]
- [Component/technology 2]
- [Component/technology 3]

**Implementation Strategy:**
[How will this be rolled out? Phased approach? Big bang?]

**Timeline:**
[Expected implementation timeline]

**Responsibility:**
- [Role/Person 1]: [Responsibility area]
- [Role/Person 2]: [Responsibility area]

---

## Consequences

### Positive
- [Benefit 1]
- [Benefit 2]
- [Benefit 3]

### Negative
- [Cost/risk 1]
- [Cost/risk 2]
- [Trade-off 3]

### Neutral
- [Change that's neither clearly positive nor negative 1]
- [Change that's neither clearly positive nor negative 2]

---

## Alternatives Considered

### Alternative 1: [Name]

**Description:**
[What is this alternative?]

**Pros:**
- [Advantage 1]
- [Advantage 2]

**Cons:**
- [Disadvantage 1]
- [Disadvantage 2]

**Why not chosen:**
[Clear explanation of why this wasn't selected]

### Alternative 2: [Name]

**Description:**
[What is this alternative?]

**Pros:**
- [Advantage 1]
- [Advantage 2]

**Cons:**
- [Disadvantage 1]
- [Disadvantage 2]

**Why not chosen:**
[Clear explanation of why this wasn't selected]

### Alternative 3: [Name] (if applicable)

[Same structure as above]

---

## References

- [Link to meeting notes or discussion]
- [Link to research or article]
- [Link to proof of concept]
- [Related ADR-####]

---

## Review Notes (Before Acceptance)

**Reviewers**: [List of stakeholders who should review]

**Questions/Concerns:**
- [Question or concern 1]
- [Question or concern 2]

**Approval:**
- [ ] Architect Team
- [ ] Engineering Lead
- [ ] Product Owner
- [ ] DevOps/SRE
- [ ] Security Team (if applicable)

---

**Template Version**: 1.0.0
**ADR Skill**: architecture-decision-record v2.0.0
