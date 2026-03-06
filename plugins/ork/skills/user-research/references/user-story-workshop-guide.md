# User Story Workshop Guide

Facilitation guide for effective user story writing sessions.

## Workshop Structure

```
Total Time: 2-3 hours

1. Context Setting (15 min)
2. Persona Review (15 min)
3. Story Mapping (45 min)
4. Story Writing (45 min)
5. Acceptance Criteria (30 min)
6. Prioritization (20 min)
7. Wrap-up (10 min)
```

## 1. Context Setting (15 min)

### Facilitator Script
```
"Today we're writing user stories for [feature]. Our goal is to
break down the work into independent, valuable pieces that can
be estimated and prioritized.

Remember: We're focusing on WHAT users need, not HOW we'll build it."
```

### Materials Needed
- Large whiteboard or Miro board
- Sticky notes (3 colors: personas, stories, criteria)
- Sharpies
- Timer
- Persona cards (printed)

## 2. Persona Review (15 min)

Review the primary persona(s) for this feature:

```markdown
Quick Refresher:
- Who is [Persona Name]?
- What are their top 3 goals?
- What are their top 3 pain points?
- What context do they work in?
```

### Activity
Each participant writes 1 "Job to be Done" for the persona on a sticky note.

## 3. Story Mapping (45 min)

### Backbone Creation

```
USER JOURNEY: [Feature Name]

Discovery → Setup → First Use → Regular Use → Mastery
    │          │         │           │           │
    ▼          ▼         ▼           ▼           ▼
[Stories] [Stories] [Stories]  [Stories]   [Stories]
```

### Process
1. Identify journey stages (10 min)
2. Add activities under each stage (15 min)
3. Break activities into stories (20 min)

## 4. Story Writing (45 min)

### Template
```
As a [persona],
I want to [action/goal],
so that [benefit/outcome].
```

### INVEST Check (for each story)

| Criterion | Question | ✓ |
|-----------|----------|---|
| Independent | Can this be built separately? | |
| Negotiable | Are details discussable? | |
| Valuable | Does this deliver user value? | |
| Estimable | Can the team size this? | |
| Small | Does this fit in a sprint? | |
| Testable | Can we verify it's done? | |

### Common Story Splits

| If story is too big... | Split by... |
|------------------------|-------------|
| Multiple user types | Different personas |
| Multiple actions | Workflow steps |
| Multiple data types | Data variations |
| Multiple platforms | Platform/device |
| Complex rules | Simple → complex rules |

## 5. Acceptance Criteria (30 min)

### Given-When-Then Format

```text
Scenario: [Scenario name]
  Given [precondition/context]
  When [action taken]
  Then [expected result]
  And [additional result]
```

### Example

```text
Scenario: User filters search results by date
  Given I have search results displayed
  And the date filter is visible
  When I select "Last 7 days"
  Then only results from the last 7 days are shown
  And the filter shows "Last 7 days" as selected
  And the result count updates
```

### Edge Cases to Consider

- Empty states (no data)
- Error conditions
- Boundary values
- Permission variations
- Network failures

## 6. Prioritization (20 min)

### MoSCoW Quick Sort

| Category | Meaning | Time allocation |
|----------|---------|-----------------|
| Must | MVP, launch blocker | 60% |
| Should | Important, not blocking | 20% |
| Could | Nice to have | 15% |
| Won't | Out of scope | 5% (document why) |

### Dot Voting
- Each participant gets 3 dots
- Vote on most valuable stories
- Count votes, sort by priority

## 7. Wrap-up (10 min)

### Deliverables Checklist
- [ ] Stories mapped to journey
- [ ] Each story has acceptance criteria
- [ ] Stories prioritized (MoSCoW)
- [ ] Dependencies identified
- [ ] Next steps assigned

### Follow-up Actions
- [ ] Transfer to issue tracker
- [ ] Schedule estimation session
- [ ] Share with stakeholders
