# ADR Best Practices

Complete reference guide for creating, managing, and evolving Architecture Decision Records following industry best practices and the Nygard format.

---

## Table of Contents

1. [When to Write an ADR](#when-to-write-an-adr)
2. [ADR Lifecycle Management](#adr-lifecycle-management)
3. [Linking Related ADRs](#linking-related-adrs)
4. [Review and Approval Process](#review-and-approval-process)
5. [Common Anti-Patterns](#common-anti-patterns)
6. [Integration with Git Workflow](#integration-with-git-workflow)
7. [Good vs Bad ADR Titles](#good-vs-bad-adr-titles)
8. [Quantifying Impact and Risk](#quantifying-impact-and-risk)

---

## When to Write an ADR

### Decision Thresholds

Not every decision requires an ADR. Use these criteria to determine when to write one:

#### ALWAYS Write an ADR For:

1. **Technology Selection**
   - Choosing a database (PostgreSQL, MongoDB, Redis)
   - Adopting a framework (React, Angular, Vue)
   - Cloud provider selection (AWS, GCP, Azure)
   - Programming language for new services

2. **Architectural Patterns**
   - Microservices vs monolith
   - Event-driven architecture
   - CQRS or Event Sourcing
   - API Gateway implementation

3. **Infrastructure Decisions**
   - Kubernetes vs serverless
   - CI/CD pipeline strategy
   - Monitoring and observability stack
   - Deployment topology

4. **Cross-Cutting Concerns**
   - Authentication/authorization strategy
   - API versioning approach
   - Data migration strategy
   - Security architecture

5. **Major Refactoring**
   - Splitting a monolith
   - Database migration
   - Protocol changes (REST to GraphQL)
   - Framework upgrade with breaking changes

#### CONSIDER Writing an ADR For:

1. **Team Conventions**
   - Code style standards (if highly debated)
   - Branching strategy (if complex)
   - Testing approaches (if significant investment)

2. **Tool Adoption**
   - Development tools (if team-wide impact)
   - Third-party services (if cost >$10k/year)
   - Build systems (if affects all developers)

#### SKIP ADR For:

1. **Tactical Decisions**
   - Variable naming
   - Minor library updates
   - Cosmetic code changes
   - Temporary workarounds

2. **Reversible Choices**
   - CSS framework (easily swappable)
   - Logging library (minimal coupling)
   - Development IDE preferences

3. **Implementation Details**
   - Specific algorithm choice (unless performance-critical)
   - File organization within a module
   - Test fixture structure

### Cost-Benefit Threshold

**Rule of Thumb**: If reversing the decision would take >2 weeks of engineering effort, write an ADR.

**Examples:**
- Switching databases: 8 weeks → ✅ Write ADR
- Changing CSS-in-JS library: 3 days → ❌ Skip ADR
- Adopting GraphQL: 6 weeks → ✅ Write ADR
- Updating linter config: 2 hours → ❌ Skip ADR

### Impact Radius

**Write ADR if decision affects:**
- 3+ developers
- 2+ teams
- External stakeholders (customers, partners)
- Compliance or security posture

---

## ADR Lifecycle Management

### Status Values and Transitions

```
                    ┌──────────┐
                    │ PROPOSED │
                    └─────┬────┘
                          │
                ┌─────────┴─────────┐
                │                   │
                ▼                   ▼
         ┌──────────┐        ┌──────────┐
         │ ACCEPTED │        │ REJECTED │
         └─────┬────┘        └──────────┘
               │
               ▼
        ┌─────────────┐
        │ IMPLEMENTED │
        └──────┬──────┘
               │
        ┌──────┴──────────┐
        │                 │
        ▼                 ▼
  ┌──────────┐      ┌────────────┐
  │ SUPERSEDED│      │ DEPRECATED │
  └──────────┘      └────────────┘
```

### 1. PROPOSED (Draft)

**When**: ADR is written but not yet approved

**Actions:**
- Author creates ADR using template
- Gathers feedback from stakeholders
- Iterates on content based on questions
- Schedules review meeting

**Duration**: 3-14 days typically

**Best Practices:**
- Share early in Slack/email for async feedback
- Keep status as "Proposed" until formal approval
- Document questions/concerns in "Review Notes" section
- Update ADR based on feedback before approval meeting

**Example Header:**
```markdown
**Status**: Proposed
**Date**: 2025-12-15
**Authors**: Jane Smith (Backend Architect)
**Reviewers**: Architecture Team, DevOps Lead
```

### 2. ACCEPTED (Approved)

**When**: Team agrees to proceed with the decision

**Actions:**
- Change status from "Proposed" to "Accepted"
- Add approval date and stakeholder sign-offs
- Commit to main branch
- Announce to relevant teams
- Create implementation tickets/PRs

**Best Practices:**
- Document who approved and when
- Link ADR in implementation PRs
- Keep ADR immutable after acceptance (no edits)
- Reference ADR number in related code comments

**Example Header:**
```markdown
**Status**: Accepted
**Date**: 2025-12-15
**Accepted**: 2025-12-20
**Authors**: Jane Smith (Backend Architect)
**Approved By**: Architecture Team (2025-12-20), CTO (2025-12-20)
```

### 3. IMPLEMENTED (In Production)

**When**: Decision is live in production

**Actions:**
- Update status to "Implemented"
- Add implementation date
- Link to relevant PRs/commits
- Document actual vs expected outcomes (optional)

**Best Practices:**
- Wait for production deployment before marking implemented
- Add "Lessons Learned" section if actual results differ from expected
- Use this status to track completion of major initiatives
- Schedule post-implementation review (3-6 months)

**Example Header:**
```markdown
**Status**: Implemented
**Date**: 2025-12-15
**Accepted**: 2025-12-20
**Implemented**: 2026-03-10
**Implementation**: [PR #4567](https://github.com/org/repo/pull/4567)
```

### 4. SUPERSEDED (Replaced)

**When**: A newer ADR replaces this decision

**Actions:**
- Change status to "Superseded"
- Add reference to new ADR number
- Explain why decision was revisited
- Keep original ADR unchanged (historical record)

**Best Practices:**
- Don't delete superseded ADRs (architectural history)
- Link both directions (old → new, new → old)
- Explain what changed that necessitated new decision
- Document migration timeline in new ADR

**Example Header:**
```markdown
**Status**: Superseded by ADR-0042
**Date**: 2025-12-15
**Accepted**: 2025-12-20
**Implemented**: 2026-03-10
**Superseded**: 2026-11-15 - Migration to GraphQL required new API versioning strategy
**See**: ADR-0042 - API Versioning for GraphQL Gateway
```

### 5. DEPRECATED (No Longer Recommended)

**When**: Decision is discouraged but not yet replaced

**Actions:**
- Change status to "Deprecated"
- Document why it's deprecated
- Add migration path if available
- Keep original ADR for historical context

**Best Practices:**
- Use when phasing out a practice (not immediate replacement)
- Document timeline for deprecation (if known)
- Provide alternative guidance
- Don't mark as deprecated just because tech is old (if still works)

**Example Header:**
```markdown
**Status**: Deprecated (as of 2026-10-01)
**Date**: 2025-12-15
**Accepted**: 2025-12-20
**Implemented**: 2026-03-10
**Deprecated**: 2026-10-01 - REST API v1 deprecated, migrate to v2 by 2027-01-01
**Migration Guide**: [docs/api-v1-to-v2-migration.md](../migration/api-v1-to-v2.md)
```

### 6. REJECTED (Not Adopted)

**When**: After review, team decides NOT to proceed

**Actions:**
- Change status to "Rejected"
- Document why decision was rejected
- Capture dissenting opinions if valuable
- Keep ADR as record of what was considered

**Best Practices:**
- Don't delete rejected ADRs (prevents revisiting same debate)
- Be specific about rejection reasons
- Note if decision should be revisited later
- Link to alternative approach if one exists

**Example Header:**
```markdown
**Status**: Rejected
**Date**: 2025-12-15
**Rejected**: 2025-12-18 - Team voted 7-2 against due to operational complexity concerns
**Rejection Reason**: Kubernetes migration deemed too risky given team's lack of container experience. Revisit in 12 months after hiring DevOps engineer.
```

### Lifecycle Best Practices

1. **Immutability**: Once accepted, don't edit ADRs. Create new ones that supersede.
2. **Atomic Status Changes**: Use git commits to track status changes
3. **Timestamps**: Always include dates for status transitions
4. **Bidirectional Links**: When superseding, update both old and new ADRs
5. **Preserve History**: Never delete ADRs, even rejected or superseded ones

---

## Linking Related ADRs

### Why Link ADRs?

- Show architectural evolution over time
- Prevent contradictory decisions
- Help readers understand context and dependencies
- Enable impact analysis when revisiting decisions

### Types of ADR Relationships

#### 1. Supersedes / Superseded By

**Use when**: A new ADR replaces an old decision

**Format:**
```markdown
# ADR-0015: Adopt GraphQL API Gateway

**Status**: Accepted
**Supersedes**: ADR-0003 (REST API Versioning Strategy)
```

```markdown
# ADR-0003: REST API Versioning Strategy

**Status**: Superseded by ADR-0015
**Superseded by**: ADR-0015 - Adopt GraphQL API Gateway
```

**Best Practice**: Update both ADRs with bidirectional links

#### 2. Depends On / Enables

**Use when**: Decision relies on another ADR or enables future decisions

**Format:**
```markdown
# ADR-0020: Implement CQRS Pattern

**Depends On**:
- ADR-0015 - Adopt GraphQL API Gateway (required for command mutations)
- ADR-0012 - Event-Driven Architecture (required for event sourcing)

## Context

This ADR builds on our GraphQL adoption (ADR-0015) by separating
read and write operations into distinct models...
```

**Best Practice**: Link in "References" section if dependency is strong

#### 3. Related To / See Also

**Use when**: Decisions are in same domain but not strictly dependent

**Format:**
```markdown
# ADR-0025: Database Sharding Strategy

**Related ADRs**:
- ADR-0002 - Choose PostgreSQL (same database)
- ADR-0018 - Caching Strategy (complementary performance approach)
- ADR-0021 - Read Replica Configuration (alternative scaling strategy)

## Context

While ADR-0021 addressed read scaling via replicas, this ADR
focuses on write scaling through sharding...
```

#### 4. Amends / Amended By

**Use when**: ADR clarifies or extends (but doesn't replace) another ADR

**Format:**
```markdown
# ADR-0030: API Rate Limiting Implementation

**Amends**: ADR-0003 - REST API Versioning Strategy
**Note**: Adds rate limiting requirement not addressed in original ADR

## Context

ADR-0003 established our API versioning approach but didn't
address rate limiting. This ADR fills that gap...
```

**When to Amend vs Supersede:**
- **Amend**: Adding new information, clarifying, extending scope
- **Supersede**: Replacing the core decision entirely

### Linking in Git

**Directory Structure:**
```
docs/adr/
├── README.md (ADR index with links)
├── adr-0001-microservices.md
├── adr-0002-postgresql.md
├── adr-0003-api-versioning.md
└── adr-0015-graphql-gateway.md
```

**ADR Index (README.md):**
```markdown
# Architecture Decision Records

## Active Decisions
- [ADR-0015](adr-0015-graphql-gateway.md) - GraphQL API Gateway
- [ADR-0002](adr-0002-postgresql.md) - PostgreSQL for Data Persistence

## Superseded
- [ADR-0003](adr-0003-api-versioning.md) - REST API Versioning (→ ADR-0015)

## Rejected
- [ADR-0010](adr-0010-nosql-migration.md) - NoSQL Migration

## By Topic
### API Design
- ADR-0003 (superseded), ADR-0015, ADR-0030

### Data Storage
- ADR-0002, ADR-0010 (rejected), ADR-0025
```

**Best Practice**: Maintain an index file for easy discovery

### Linking Best Practices

1. **Always Link Bidirectionally**: If A supersedes B, update both A and B
2. **Use Relative Links**: `[ADR-0015](adr-0015-graphql-gateway.md)`
3. **Link Early in ADR**: Reference related ADRs in Context or Decision sections
4. **Explain Relationship**: Don't just link, explain why it's relevant
5. **Update Index**: Keep README.md index current for discoverability

---

## Review and Approval Process

### Pre-Review Phase (Author)

**Timeline**: 1-3 days before review meeting

**Actions:**
1. **Self-Review** using `/checklists/adr-review-checklist.md`
2. **Share Early**: Post ADR in Slack/Teams for async feedback
3. **Identify Reviewers**: List required stakeholders
4. **Schedule Meeting**: Book 30-60 minute review session
5. **Share ADR**: Send at least 48 hours before meeting

**Best Practices:**
- Request specific feedback: "Focus on alternatives section"
- Highlight areas of uncertainty: "Not sure about timeline"
- Share related research or PoC results
- Pre-address obvious questions in "Review Notes"

### Review Meeting (Team)

**Duration**: 30-60 minutes

**Agenda:**
1. **Context Presentation** (5-10 min): Author explains problem
2. **Decision Walkthrough** (5 min): What we're choosing and why
3. **Alternatives Discussion** (10-15 min): Why not other options?
4. **Consequences Review** (10-15 min): Trade-offs and risks
5. **Q&A** (10-20 min): Open discussion
6. **Decision** (5 min): Approve, reject, or request changes

**Participants:**

| Role | Required? | Why |
|------|-----------|-----|
| **Author** | Yes | Presents and defends decision |
| **Architect** | Yes | Technical viability, consistency |
| **Tech Lead** | Yes | Implementation feasibility |
| **DevOps/SRE** | Depends | If operational impact |
| **Security** | Depends | If security implications |
| **Product** | Depends | If business impact significant |
| **Team Members** | Optional | Implementation team buy-in |

**Meeting Facilitation:**
- **Facilitator** (not author): Keeps discussion on track
- **Timekeeper**: Ensures agenda stays on schedule
- **Note-taker**: Documents questions, concerns, action items

### Decision Outcomes

#### 1. APPROVED (Best Case)

**Criteria:**
- ✅ All required stakeholders agree
- ✅ No major concerns unresolved
- ✅ Implementation path is clear

**Actions:**
- Update status to "Accepted"
- Add approval signatures with dates
- Commit ADR to main branch
- Create implementation tickets
- Announce to team

#### 2. APPROVED WITH CHANGES (Common)

**Criteria:**
- ✅ Decision is sound but ADR needs minor updates
- ✅ Questions raised but answerable
- ✅ Consequences need clarification

**Actions:**
- Document required changes
- Author updates ADR within 1 week
- Re-share for final approval (async or brief meeting)
- Mark as "Accepted" after changes incorporated

**Example Changes:**
- Add missing alternative
- Clarify timeline
- Expand consequences section
- Add quantitative data

#### 3. DEFERRED (Needs More Info)

**Criteria:**
- ❌ Insufficient information to decide
- ❌ Proof of concept needed
- ❌ Missing critical stakeholder input

**Actions:**
- Keep status as "Proposed"
- Document blockers and information needed
- Set timeline to gather info (2-4 weeks)
- Schedule follow-up review

**Example Blockers:**
- "Need cost analysis from Finance"
- "Requires PoC to validate performance claims"
- "Security team needs to review first"

#### 4. REJECTED

**Criteria:**
- ❌ Decision doesn't align with strategy
- ❌ Risks outweigh benefits
- ❌ Better alternative exists

**Actions:**
- Update status to "Rejected"
- Document rejection reasons
- Capture in git for historical record
- If alternative chosen, create new ADR

### Approval Signatures

**Format:**
```markdown
## Review & Approval

**Reviewers**: Architecture Team, DevOps, Security

**Approval Status:**
- ✅ Jane Smith (Chief Architect) - 2025-12-20
- ✅ John Doe (Tech Lead) - 2025-12-20
- ✅ Sarah Johnson (DevOps Lead) - 2025-12-21
- ⏳ Mike Chen (Security) - Pending review
```

**Best Practices:**
- Use real names and roles (for accountability)
- Include approval dates (track decision timeline)
- Require sign-off before implementation begins
- Store signatures in git (immutable record)

### Async Review (Alternative)

For non-critical decisions, async review via GitHub PR:

1. **Create PR** with ADR file
2. **Request Reviews** from stakeholders
3. **Discuss in Comments** (threaded conversations)
4. **Approve PR** = Accept ADR
5. **Merge to Main** = Officially accepted

**Best for:**
- Straightforward decisions
- Distributed teams across timezones
- Low-controversy choices
- Well-documented alternatives

---

## Common Anti-Patterns

### 1. The "Rubber Stamp" ADR

**Problem**: ADR written AFTER decision is already made and implemented

**Symptoms:**
- Status jumps straight to "Implemented"
- No alternatives considered (decision was foregone)
- Written to satisfy process, not inform decision

**Why It's Bad:**
- Defeats purpose of ADRs (inform decisions, not document past)
- Wastes time (no one reads post-facto justifications)
- Builds cynicism about process

**Fix:**
✅ Write ADRs BEFORE implementation begins
✅ If decision already made, be honest: "Status: Implemented (retrospective)"
✅ Use retrospective ADRs sparingly, only for critical undocumented decisions

**Example Anti-Pattern:**
```markdown
# ADR-0008: Use Redis for Caching

Status: Implemented
Date: 2025-12-01
Implemented: 2025-11-15  ← Decision made 2 weeks before ADR!

## Decision
We already implemented Redis caching last month.
```

### 2. The "Novel" ADR

**Problem**: ADR is 10+ pages of exhaustive detail

**Symptoms:**
- Includes implementation code samples
- Documents every edge case
- Contains architectural diagrams with 20+ components
- Multiple pages of research citations

**Why It's Bad:**
- No one reads it (TL;DR effect)
- Mixes decision rationale with implementation guide
- Hard to maintain (becomes outdated quickly)

**Fix:**
✅ Keep ADRs to 2-4 pages (500-1500 words)
✅ Focus on WHY, not HOW
✅ Link to separate docs for implementation details
✅ Use concise bullet points

**Guideline**: If you need 30+ minutes to read the ADR, it's too long

### 3. The "Vague" ADR

**Problem**: Decision is too abstract to implement

**Symptoms:**
- "We will improve performance" (how?)
- "We will adopt modern technologies" (which ones?)
- "We will consider using microservices" (decide or don't!)

**Why It's Bad:**
- Can't implement from vague decision
- Doesn't prevent future debates
- Alternatives can't be evaluated

**Fix:**
✅ Be specific: versions, tools, technologies named
✅ Use declarative language: "We WILL adopt X"
✅ Include implementation strategy
✅ Define success criteria

**Example:**

❌ **Vague**: "We will improve our API architecture"

✅ **Specific**: "We will migrate from REST to GraphQL using Apollo Server 4+ by Q2 2026"

### 4. The "No Alternatives" ADR

**Problem**: Only documents chosen solution

**Symptoms:**
- Alternatives section has 1 option (status quo)
- Alternatives are strawmen (clearly inferior)
- No comparative analysis

**Why It's Bad:**
- Looks like decision was predetermined
- Misses opportunity to learn from rejected options
- Future team may revisit same debate

**Fix:**
✅ Document at least 2-3 real alternatives
✅ Present alternatives fairly (with genuine pros)
✅ Explain why each wasn't chosen
✅ Include "do nothing" as valid alternative

### 5. The "Positives Only" ADR

**Problem**: Only lists benefits, ignores costs/risks

**Symptoms:**
- Consequences section has 10 pros, 1 con
- Negatives are trivial: "Slight learning curve"
- Operational complexity ignored

**Why It's Bad:**
- Unrealistic (every decision has trade-offs)
- Team blindsided by downsides later
- Erodes trust in ADR process

**Fix:**
✅ Be honest about costs and risks
✅ Document operational complexity
✅ Quantify negatives where possible
✅ Include neutral consequences (not just pros/cons)

**Example:**

❌ **Positives Only**:
```markdown
### Positive
- Faster performance
- Better developer experience
- Modern technology

### Negative
- Slight learning curve
```

✅ **Balanced**:
```markdown
### Positive
- 50% faster response times (benchmarked)
- Improved DX with TypeScript autocomplete

### Negative
- 2-3 month team ramp-up period
- Adds 15% to infrastructure costs ($3k/month)
- Debugging distributed systems harder
- Need new monitoring tools (Jaeger)
```

### 6. The "Over-Engineered" Solution

**Problem**: Choosing complex solution for simple problem

**Symptoms:**
- Microservices for 2-person team
- Kubernetes for single service
- Event sourcing for basic CRUD app

**Why It's Bad:**
- Operational burden exceeds benefits
- Team overwhelmed by complexity
- Slows development instead of speeding it

**Fix:**
✅ Match solution complexity to problem complexity
✅ Consider team size and skills
✅ Start simple, evolve as needed
✅ Document when to revisit decision

**YAGNI Principle**: You Aren't Gonna Need It (yet)

### 7. The "Technology Resume Padding" ADR

**Problem**: Choosing trendy tech for learning, not business value

**Symptoms:**
- Decision justified by "learning opportunity"
- Latest JavaScript framework despite team experience in another
- Technology choice driven by conference talks, not requirements

**Why It's Bad:**
- Puts engineer growth ahead of business needs
- Increases risk and time-to-market
- May leave technical debt when team members leave

**Fix:**
✅ Prioritize business value over technology trends
✅ Separate learning projects from production systems
✅ Choose boring technology for critical systems
✅ Be honest if decision has learning component

**Exception**: Early-stage startups optimizing for recruiting may choose trendy tech intentionally (but document this reasoning!)

### 8. The "Missing Context" ADR

**Problem**: Jumps straight to solution without explaining problem

**Symptoms:**
- Context section is 2 sentences
- No quantitative data (users, load, costs)
- Requirements and constraints missing

**Why It's Bad:**
- Readers don't understand why decision matters
- Can't evaluate if solution fits problem
- Future team may reverse decision unknowingly

**Fix:**
✅ Spend 30-40% of ADR on context
✅ Include quantitative data (numbers!)
✅ Document constraints and forces
✅ Explain "why now?" timing

### 9. The "Zombie" ADR

**Problem**: Superseded ADR not marked as such

**Symptoms:**
- Old ADR still shows status "Accepted"
- Team members reference outdated decisions
- Contradictory ADRs both appear current

**Why It's Bad:**
- Creates confusion about current state
- Wastes time following obsolete guidance
- Degrades trust in ADR system

**Fix:**
✅ Update old ADRs when superseded
✅ Add bidirectional links
✅ Maintain ADR index/README
✅ Periodic ADR audit (quarterly)

---

## Integration with Git Workflow

### Repository Structure

```
repo/
├── docs/
│   ├── adr/
│   │   ├── README.md (ADR index)
│   │   ├── adr-0001-microservices.md
│   │   ├── adr-0002-postgresql.md
│   │   └── template.md
│   ├── architecture/
│   └── api/
├── src/
└── tests/
```

**Best Practices:**
- ✅ Keep ADRs in `/docs/adr/` (discoverable location)
- ✅ Name files: `adr-####-brief-title.md` (sortable, descriptive)
- ✅ Store in same repo as code (version together)
- ✅ Include README.md index for navigation

### Branching Strategy

#### Option 1: Feature Branch with Code

**Use when**: ADR is tied to specific feature implementation

```bash
# Create feature branch
git checkout -b feature/graphql-migration

# Add ADR
git add docs/adr/adr-0015-graphql-gateway.md
git commit -m "docs: Add ADR-0015 for GraphQL migration"

# Implement feature
git add src/graphql/
git commit -m "feat: Implement GraphQL gateway (ADR-0015)"

# Create PR (includes ADR + implementation)
gh pr create --base main
```

**Pros:**
- ADR reviewed alongside implementation
- Code and rationale versioned together
- Clear connection between decision and code

**Cons:**
- ADR acceptance blocked by code review
- Can't reference ADR until PR merged

#### Option 2: Separate ADR Branch

**Use when**: ADR needs approval before implementation begins

```bash
# Create ADR-only branch
git checkout -b adr/adr-0015-graphql-gateway

# Add ADR in "Proposed" status
git add docs/adr/adr-0015-graphql-gateway.md
git commit -m "docs: Propose ADR-0015 for GraphQL migration"

# Create PR for review
gh pr create --base main --title "ADR-0015: GraphQL Gateway"

# After approval, update status to "Accepted"
git add docs/adr/adr-0015-graphql-gateway.md
git commit -m "docs: Accept ADR-0015 after architecture review"

# Merge ADR
gh pr merge

# Later: Implement in separate feature branch
git checkout -b feature/graphql-migration
```

**Pros:**
- ADR reviewed independently of code
- Can reference accepted ADR in implementation PR
- Clear approval timeline

**Cons:**
- Extra PR overhead
- ADR and code in separate PRs

**Recommendation**: Use Option 2 for major decisions, Option 1 for smaller ones

### Commit Messages

**Format:**
```
docs(adr): [action] ADR-#### [title]

[Optional body explaining changes]
```

**Actions:**
- `Propose` - Initial ADR creation (status: Proposed)
- `Accept` - Approval granted (status: Accepted)
- `Implement` - Mark as implemented (status: Implemented)
- `Supersede` - Replace with new ADR (status: Superseded)
- `Deprecate` - Mark as deprecated (status: Deprecated)
- `Reject` - Not adopted (status: Rejected)
- `Update` - Changes to proposed ADR (before acceptance)

**Examples:**
```bash
git commit -m "docs(adr): Propose ADR-0015 GraphQL Gateway"
git commit -m "docs(adr): Accept ADR-0015 after architecture review"
git commit -m "docs(adr): Implement ADR-0015 - GraphQL in production"
git commit -m "docs(adr): Supersede ADR-0003 with ADR-0015"
```

### Pull Request Integration

**PR Description Template:**
```markdown
## Overview
[Brief description of changes]

## Related ADR
**Implements**: [ADR-0015](../docs/adr/adr-0015-graphql-gateway.md)

## Changes
- [Change 1]
- [Change 2]

## Testing
- [Test approach]

## Checklist
- [ ] Implementation follows ADR-0015
- [ ] ADR status updated to "Implemented"
- [ ] Documentation updated
```

**Best Practices:**
- Link ADR in every PR that implements it
- Validate implementation matches ADR decision
- Update ADR status when PR merges

### Git Hooks (Optional)

**Pre-commit hook** to enforce ADR formatting:

```bash
#!/bin/bash
# .git/hooks/pre-commit

ADR_FILES=$(git diff --cached --name-only | grep "docs/adr/adr-.*\.md")

for file in $ADR_FILES; do
  # Check ADR number format
  if ! echo "$file" | grep -qE "adr-[0-9]{4}-.*\.md"; then
    echo "ERROR: $file doesn't follow naming convention"
    echo "Expected: adr-####-brief-title.md"
    exit 1
  fi

  # Check required sections exist
  for section in "## Context" "## Decision" "## Consequences"; do
    if ! grep -q "$section" "$file"; then
      echo "ERROR: $file missing required section: $section"
      exit 1
    fi
  done
done

exit 0
```

**Make executable:**
```bash
chmod +x .git/hooks/pre-commit
```

---

## Good vs Bad ADR Titles

### Title Format

```
ADR-####: [Verb] [Object] [Context]
```

**Length**: 3-8 words (short but descriptive)

### Good Titles

| Title | Why It's Good |
|-------|---------------|
| `ADR-0001: Adopt Microservices Architecture` | ✅ Action-oriented verb, clear scope |
| `ADR-0015: Migrate from REST to GraphQL` | ✅ Shows transition, specific technologies |
| `ADR-0023: Use PostgreSQL for Transactional Data` | ✅ Specifies use case (transactional) |
| `ADR-0031: Implement JWT Authentication with Refresh Tokens` | ✅ Specific technology and pattern |
| `ADR-0042: Shard User Database by Region` | ✅ Clear action and dimension |
| `ADR-0050: Deprecate API v1 in Favor of v2` | ✅ Shows lifecycle action |

### Bad Titles (and How to Fix)

| Bad Title | Problem | Fixed Version |
|-----------|---------|---------------|
| `ADR-0008: Database` | ❌ Too vague | `ADR-0008: Choose PostgreSQL for Primary Database` |
| `ADR-0012: Performance` | ❌ Topic, not decision | `ADR-0012: Implement Redis Caching for API Responses` |
| `ADR-0019: We Should Probably Think About Using Microservices Maybe` | ❌ Wishy-washy, too long | `ADR-0019: Adopt Microservices Architecture` |
| `ADR-0025: Technology Modernization Initiative` | ❌ Too broad | `ADR-0025: Upgrade React 16 to React 19` |
| `ADR-0033: The Reasons Why We Decided to Choose Kubernetes Over AWS ECS After Extensive Evaluation` | ❌ Too long, wordy | `ADR-0033: Choose Kubernetes over AWS ECS` |
| `ADR-0040: Fix the Authentication Problem` | ❌ Sounds like bug fix | `ADR-0040: Implement OAuth 2.0 Authentication` |

### Title Patterns by Decision Type

**Technology Selection:**
- ✅ `Choose [Technology] for [Use Case]`
- ✅ `Adopt [Technology] for [Purpose]`
- Examples:
  - `Choose PostgreSQL for Primary Database`
  - `Adopt Kubernetes for Container Orchestration`

**Architecture Patterns:**
- ✅ `Implement [Pattern] for [Domain]`
- ✅ `Adopt [Architectural Style]`
- Examples:
  - `Implement CQRS for Order Management`
  - `Adopt Event-Driven Architecture`

**Migrations:**
- ✅ `Migrate from [Old] to [New]`
- ✅ `Replace [Old] with [New]`
- Examples:
  - `Migrate from MongoDB to PostgreSQL`
  - `Replace REST API with GraphQL Gateway`

**Conventions/Standards:**
- ✅ `Standardize [Aspect] using [Approach]`
- ✅ `Enforce [Rule] via [Mechanism]`
- Examples:
  - `Standardize API Versioning using Semantic Versioning`
  - `Enforce Code Style via Prettier and ESLint`

**Lifecycle Actions:**
- ✅ `Deprecate [Old Technology]`
- ✅ `Retire [Old System] by [Date]`
- Examples:
  - `Deprecate API v1 in Favor of v2`
  - `Retire Legacy Payment Service by Q2 2026`

---

## Quantifying Impact and Risk

### Why Quantify?

Quantitative data makes ADRs:
- **More credible**: Numbers beat opinions
- **More comparable**: Objective criteria for alternatives
- **More trackable**: Measure actual vs predicted outcomes
- **More accountable**: Clear success criteria

### What to Quantify

#### 1. Performance Impact

**Metrics:**
- Response time (ms, p50/p95/p99)
- Throughput (requests/second)
- Resource usage (CPU %, memory GB)
- Database query time (ms)

**Example:**
```markdown
## Consequences

### Positive
- **Response Time**: Reduce p95 latency from 250ms to 80ms (68% improvement)
- **Throughput**: Increase from 1,000 to 5,000 req/sec (5x)
- **Database Load**: Reduce queries by 70% via caching

### Negative
- **Memory Usage**: Increase from 2GB to 4GB per instance (+100%)
- **Cold Start**: Add 500ms cold start time for Lambda functions
```

#### 2. Cost Impact

**Metrics:**
- Infrastructure cost ($USD/month)
- Engineer time (person-weeks)
- Opportunity cost (delayed features)
- Operational overhead (on-call hours)

**Example:**
```markdown
## Cost Analysis

### Implementation Costs
- **Engineering**: 8 weeks × 3 engineers = 24 person-weeks ($120k)
- **Infrastructure**: New Kubernetes cluster = $5k/month
- **Training**: 2-week ramp-up per team member = 10 person-weeks ($50k)
- **Total**: $170k one-time + $5k/month recurring

### Savings
- **Developer Productivity**: 40% faster deployments = 5 hours/week saved
- **Infrastructure**: Auto-scaling reduces over-provisioning by $3k/month
- **Downtime**: Zero-downtime deploys save $10k/incident × 2 incidents/year

### ROI
- **Break-even**: 12 months
- **5-year NPV**: $450k savings
```

#### 3. Scalability Impact

**Metrics:**
- Users supported (daily active users)
- Data volume (GB, TB)
- Geographic reach (regions, latency)
- Concurrent connections

**Example:**
```markdown
## Scalability Impact

### Current State
- **Users**: 100,000 DAU
- **Data**: 500 GB database
- **Regions**: US-East only
- **Peak Load**: 2,000 concurrent users

### After Implementation
- **Users**: 1,000,000 DAU (10x) ✅
- **Data**: 10 TB (20x) via sharding ✅
- **Regions**: US-East, US-West, EU, Asia ✅
- **Peak Load**: 50,000 concurrent (25x) ✅
```

#### 4. Risk Assessment

**Metrics:**
- Probability (0-100%)
- Impact (1-5 scale: negligible to critical)
- Risk Score (probability × impact)
- Mitigation effort (person-weeks)

**Example:**
```markdown
## Risk Assessment

| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| Team lacks Kubernetes experience | 80% | High (4) | 3.2 | Hire DevOps engineer, 4-week training ($60k) |
| Service mesh adds complexity | 60% | Medium (3) | 1.8 | Start with simple mesh, iterate |
| Migration causes data loss | 10% | Critical (5) | 0.5 | Extensive testing, rollback plan |
| Cost overruns by 50% | 40% | Medium (3) | 1.2 | Phased rollout, monthly cost review |

**High-Risk Items** (score > 2.0):
- Kubernetes learning curve: Mitigated via hiring and training
```

#### 5. Timeline Impact

**Metrics:**
- Implementation time (weeks)
- Time to value (weeks until benefits realized)
- Deployment frequency (deploys/day)
- Lead time (commit to production)

**Example:**
```markdown
## Timeline

### Implementation
- **Phase 1** (Weeks 1-4): Infrastructure setup, team training
- **Phase 2** (Weeks 5-8): Service migration (Notification, Analytics)
- **Phase 3** (Weeks 9-16): Core services (User, Order, Inventory)
- **Total**: 16 weeks to full migration

### Time to Value
- **Week 6**: First services deployed (faster iteration begins)
- **Week 10**: 50% traffic on microservices (partial scaling benefits)
- **Week 16**: 100% migration (full benefits realized)

### Metrics Improvement
| Metric | Before | After | Timeline |
|--------|--------|-------|----------|
| Deploy frequency | 1/week | 10/day | Week 6 |
| Build time | 45 min | 3 min | Week 6 |
| Lead time | 2 weeks | 2 days | Week 10 |
```

#### 6. Team Impact

**Metrics:**
- Learning curve (weeks to productivity)
- Team satisfaction (1-5 survey)
- Onboarding time (days for new hires)
- Cognitive load (technologies per developer)

**Example:**
```markdown
## Team Impact

### Learning Curve
- **Kubernetes**: 2-3 weeks to basic proficiency, 3 months to mastery
- **Service Mesh**: 1 week to understand, 1 month to debug confidently
- **Distributed Systems**: 2-4 months to internalize patterns

### Developer Experience
- **Positive**: Faster feedback loops (3 min builds vs 45 min)
- **Negative**: More complex debugging (distributed tracing required)
- **Neutral**: Different tech stack (Node.js → potentially Python for some services)

### Team Readiness
| Team Member | Kubernetes | Service Mesh | Distributed Systems | Ready? |
|-------------|------------|--------------|---------------------|--------|
| Jane (Architect) | Expert | Intermediate | Expert | ✅ Yes |
| John (Lead) | Beginner | None | Intermediate | ⚠️ Training needed |
| Sarah (DevOps) | Expert | Expert | Expert | ✅ Yes |
| Team (avg) | Beginner | None | Beginner | ❌ 3-month ramp-up |
```

### Quantification Best Practices

1. **Use Ranges**: `50-100ms` instead of `75ms` (acknowledges uncertainty)
2. **Show Baseline**: Always compare to current state
3. **Source Your Numbers**: Link to benchmarks, PoCs, or research
4. **Be Conservative**: Underestimate benefits, overestimate costs
5. **Track Actuals**: Revisit ADR after implementation to compare predictions vs reality

### When You Can't Quantify

Sometimes quantification is hard or misleading:

**Don't Force It:**
- Developer happiness (use qualitative descriptions)
- Code maintainability (subjective, context-dependent)
- Strategic alignment (qualitative business value)

**Instead:**
- Use relative comparisons: "significantly faster", "moderately more complex"
- Provide qualitative reasoning: "Aligns with our cloud-first strategy"
- Reference case studies: "Netflix saw 5x improvement in similar migration"

---

## Summary Checklist

Use this quick reference before creating or reviewing an ADR:

### Before Writing
- [ ] Decision meets threshold (affects 3+ devs, >2 weeks to reverse)
- [ ] Alternative solutions explored
- [ ] Stakeholders identified

### While Writing
- [ ] Title is clear and action-oriented (3-8 words)
- [ ] Context explains problem with quantitative data
- [ ] Decision is specific (technologies, versions, timeline)
- [ ] Consequences include positives, negatives, and neutral
- [ ] At least 2 alternatives documented fairly
- [ ] Quantified: cost, performance, timeline, risk

### Before Approval
- [ ] Reviewed by relevant stakeholders
- [ ] Questions and concerns addressed
- [ ] Status is "Proposed" (not yet "Accepted")
- [ ] Linked to related ADRs if applicable

### After Approval
- [ ] Status changed to "Accepted"
- [ ] Approval signatures added
- [ ] Committed to main branch
- [ ] ADR linked in implementation PRs

### During Implementation
- [ ] Status updated to "Implemented" when live
- [ ] Implementation links added (PRs, commits)
- [ ] Actual outcomes compared to predictions

### Lifecycle Management
- [ ] Superseded ADRs updated with bidirectional links
- [ ] Deprecated ADRs include migration path
- [ ] ADR index (README) kept current
- [ ] Quarterly audit for zombie ADRs

---

## Related Resources

**Templates:**
- `/assets/adr-template.md` - Standard ADR template
- `/scripts/adr-frontmatter.yaml` - YAML metadata for tooling

**Examples:**
- `/examples/adr-0001-adopt-microservices.md` - Full example ADR
- `/examples/adr-0002-choose-postgresql.md` - Database decision
- `/examples/adr-0003-api-versioning-strategy.md` - API pattern

**Checklists:**
- `/checklists/adr-review-checklist.md` - Complete review criteria

**Further Reading:**
- Michael Nygard: [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- ThoughtWorks Technology Radar: [Lightweight ADRs](https://www.thoughtworks.com/radar/techniques/lightweight-architecture-decision-records)
- Joel Parker Henderson: [ADR GitHub Repo](https://github.com/joelparkerhenderson/architecture-decision-record)

---

**Reference Version**: 1.0.0
**Last Updated**: 2025-12-21
**Maintained by**: AI Agent Hub Team
**Skill**: architecture-decision-record v1.0.0
