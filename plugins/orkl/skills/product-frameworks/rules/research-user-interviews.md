---
title: "Research: User Interviews & Testing"
category: research
impact: HIGH
impactDescription: "Ensures rigorous user research through structured interviews, usability testing, and systematic insight collection"
tags: user-interviews, usability-testing, research-methods, nps, sus
---

# User Interviews & Usability Testing

Methods for understanding user needs, validating designs, and gathering actionable insights.

## Research Methods Overview

| Method | When to Use | Sample Size | Time | Output |
|--------|-------------|-------------|------|--------|
| User Interviews | Early discovery, deep understanding | 5-8 | 2-3 weeks | Qualitative insights |
| Usability Testing | Validate designs, find issues | 5-10 | 1-2 weeks | Actionable fixes |
| Surveys | Quantify attitudes, preferences | 100+ | 1-2 weeks | Statistical data |
| Card Sorting | Information architecture | 15-30 | 1 week | IA recommendations |
| A/B Testing | Compare alternatives | 1000+ | 2-4 weeks | Statistical winner |

## Interview Structure

```markdown
## Interview Guide

### Warm-up (5 min)
- Introduction and consent
- "Tell me about your role and what you do day-to-day"

### Context Setting (10 min)
- "Walk me through the last time you [relevant activity]"
- "What tools or methods do you currently use?"

### Deep Dive (25 min)
- "What's the hardest part about [task]?"
- "Can you show me how you typically [action]?"
- "What would your ideal solution look like?"

### Concept Testing (optional, 15 min)
- Show prototype/concept
- "What are your initial reactions?"
- "How would this fit into your workflow?"

### Wrap-up (5 min)
- "Is there anything else you'd like to share?"
- "Who else should we talk to?"
- Thank you and incentive
```

## Interview Best Practices

| Do | Don't |
|----|-------|
| Ask open-ended questions | Ask leading questions |
| Listen more than talk | Interrupt or fill silences |
| Follow interesting threads | Stick rigidly to script |
| Ask "why" and "how" | Accept surface answers |
| Take verbatim notes | Paraphrase or interpret |

## Usability Test Plan Template

```markdown
## Usability Test Plan

### Objective
[What we're trying to learn]

### Prototype/Product
- Version: [Link or description]
- Fidelity: Low / Medium / High

### Participants
- Target: 5-10 users
- Criteria: [Who qualifies]

### Tasks
1. [Task 1]: Success criteria
2. [Task 2]: Success criteria
3. [Task 3]: Success criteria

### Metrics
- Task completion rate
- Time on task
- Error rate
- SUS score (post-test)
```

## Survey Design

### NPS Question

```
How likely are you to recommend [product] to a friend?
0  1  2  3  4  5  6  7  8  9  10

[Detractors: 0-6] [Passives: 7-8] [Promoters: 9-10]
NPS = % Promoters - % Detractors
```

### System Usability Scale (SUS)

```
10 questions, 5-point scale (Strongly disagree -> Strongly agree)
SUS Score = ((Sum of odd Qs - 5) + (25 - Sum of even Qs)) x 2.5
Range: 0-100, Average: 68
```

## Card Sorting

| Type | Description | When to Use |
|------|-------------|-------------|
| **Open** | Users create their own categories | Early IA exploration |
| **Closed** | Users sort into predefined categories | Validate proposed IA |
| **Hybrid** | Users can add categories | Balance of both |

## Research Repository Template

```markdown
## Research Finding: [Title]

### Study
- Date: [When conducted]
- Method: [Interview/Survey/etc.]
- Participants: [N and description]

### Key Insight
[One sentence summary]

### Evidence
- "[Direct quote from participant]" - P3
- [Observation or data point]

### Implications
- Product: [What to build/change]
- Design: [UX recommendation]
- Strategy: [Business consideration]
```

**Incorrect — Leading questions that bias responses:**
```markdown
Interview Questions:
- "Don't you think this feature would be useful?"
- "Wouldn't you prefer this over your current tool?"
- "You'd pay $50/month for this, right?"
```

**Correct — Open-ended questions that uncover insights:**
```markdown
Interview Questions:
- "Walk me through the last time you [relevant activity]"
- "What's the hardest part about [task]?"
- "What would your ideal solution look like?"
- "Can you show me how you typically [action]?"
```
