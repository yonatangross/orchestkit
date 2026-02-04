# 5 Whys Workshop Guide

Facilitation guide for 5 Whys root cause analysis sessions.

## When to Use 5 Whys

| Good Fit | Poor Fit |
|----------|----------|
| Single incident | Multiple simultaneous issues |
| Linear causation | Complex system interactions |
| Clear starting point | Unclear what went wrong |
| Quick resolution needed | Deep systemic investigation |
| Team learning | Blame-heavy culture |

## Workshop Structure

```
Total Time: 30-60 minutes

1. Problem Statement (10 min)
2. 5 Whys Questioning (20-30 min)
3. Root Cause Validation (10 min)
4. Action Planning (10 min)
```

## Ground Rules

**Facilitator Script:**
```
"We're here to understand WHY something happened, not WHO
is to blame. Our goal is to improve our systems and processes.

Ground rules:
1. No blame - focus on systems, not people
2. Stay curious - ask 'why' genuinely
3. Evidence-based - support answers with facts
4. One thread - don't branch too early
5. Actionable - stop when you find something fixable"
```

## The Process

### 1. Problem Statement (10 min)

Write a clear, specific problem statement:

**Template:**
```
On [date], [what happened] affecting [who/what],
resulting in [impact].
```

**Good Example:**
```
On January 15, the checkout API returned 500 errors
for 45 minutes affecting 2,300 users, resulting in
~$15,000 in lost revenue.
```

**Bad Example:**
```
The site was slow.
```

### 2. 5 Whys Questioning (20-30 min)

**Format:**
```
Why #1: Why did [problem] happen?
→ Because [cause 1]

Why #2: Why did [cause 1] happen?
→ Because [cause 2]

Why #3: Why did [cause 2] happen?
→ Because [cause 3]

Why #4: Why did [cause 3] happen?
→ Because [cause 4]

Why #5: Why did [cause 4] happen?
→ Because [ROOT CAUSE]
```

**Facilitation Tips:**

| Situation | Response |
|-----------|----------|
| Answer is vague | "Can you be more specific?" |
| Multiple causes | "Which had the biggest impact?" |
| Blame surfaces | "What system allowed that to happen?" |
| Answer is guess | "What evidence supports that?" |
| Stuck | "What would have prevented this?" |

### 3. Root Cause Validation (10 min)

**Validation Questions:**
1. If we fix this, would the problem have been prevented?
2. Is this within our control to change?
3. Can we verify this with data/evidence?
4. Is this a symptom or the actual cause?

**Root Cause Types:**

| Type | Example | Action |
|------|---------|--------|
| Process | No code review | Add process step |
| Training | Unfamiliar with system | Create documentation |
| Tool | No alerting | Add monitoring |
| Design | Single point of failure | Add redundancy |
| Communication | No handoff | Create checklist |

### 4. Action Planning (10 min)

**For each root cause, define:**

```markdown
## Action: [What to do]

**Owner:** @name
**Due:** YYYY-MM-DD
**Type:** Immediate fix / Preventive measure
**Effort:** S/M/L
**Validation:** How we'll know it worked
```

## Example: Complete 5 Whys

```markdown
## Problem Statement

On January 15 at 14:00 UTC, production database became
unresponsive for 45 minutes, causing checkout failures
for ~2,300 users and ~$15,000 lost revenue.

## 5 Whys

**Why #1:** Why did the database become unresponsive?
→ The database ran out of connections.

**Why #2:** Why did it run out of connections?
→ A query was holding connections open for too long.

**Why #3:** Why was the query taking so long?
→ It was doing a full table scan on a 10M row table.

**Why #4:** Why was it doing a full table scan?
→ The query was missing an index on the `user_id` column.

**Why #5:** Why was the index missing?
→ We don't have automated index analysis in our deployment process.

## Root Cause

Missing index on production table, combined with no
automated detection of missing indexes or slow queries.

## Actions

1. **Immediate:** Add index to `orders.user_id`
   - Owner: @database-team
   - Due: Today

2. **Preventive:** Add slow query alerting
   - Owner: @observability-team
   - Due: End of sprint

3. **Systemic:** Add index analysis to CI/CD
   - Owner: @platform-team
   - Due: Next quarter
```

## Common Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Stopping too early | Ask "Is this fixable and would it prevent the issue?" |
| Going too deep | Stop when you reach something actionable |
| Branching | Pick the most impactful branch first |
| Blame | Redirect to "What system allowed this?" |
| No evidence | Require facts for each answer |

## Post-Workshop

- [ ] Document the 5 Whys analysis
- [ ] Create tickets for actions
- [ ] Share with broader team
- [ ] Add to incident timeline
- [ ] Schedule follow-up to verify fixes
