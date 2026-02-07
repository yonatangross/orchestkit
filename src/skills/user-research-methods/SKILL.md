---
name: user-research-methods
description: User interviews, usability testing, surveys, card sorting, and qualitative research methods. Use when gathering user insights, validating designs, or understanding user behavior.
context: fork
agent: ux-researcher
version: 1.0.0
tags: [ux, research, interviews, usability, surveys, card-sorting]
author: OrchestKit
user-invocable: false
complexity: medium
---

# User Research Methods

Methods for understanding user needs, validating designs, and gathering actionable insights.

## Research Methods Overview

### Method Selection Matrix

| Method | When to Use | Sample Size | Time | Output |
|--------|-------------|-------------|------|--------|
| User Interviews | Early discovery, deep understanding | 5-8 | 2-3 weeks | Qualitative insights |
| Usability Testing | Validate designs, find issues | 5-10 | 1-2 weeks | Actionable fixes |
| Surveys | Quantify attitudes, preferences | 100+ | 1-2 weeks | Statistical data |
| Card Sorting | Information architecture | 15-30 | 1 week | IA recommendations |
| Diary Studies | Longitudinal behavior | 10-15 | 2-4 weeks | Behavior patterns |
| A/B Testing | Compare alternatives | 1000+ | 2-4 weeks | Statistical winner |

### Qualitative vs. Quantitative

```
Qualitative                              Quantitative
(Why & How)                              (What & How Many)
───────────────────────────────────────────────────────►
Interviews  Focus    Usability  Surveys  Analytics  A/B
            Groups   Testing                        Tests

Small sample                              Large sample
Rich insights                             Statistical confidence
Exploratory                               Validating
```

## User Interviews

### Interview Planning

```markdown
## Interview Plan: [Project Name]

### Research Questions
1. What problem are we trying to understand?
2. What decisions will this research inform?
3. What do we already know/assume?

### Participant Criteria
- Must have: [Required characteristics]
- Nice to have: [Preferred characteristics]
- Exclude: [Disqualifying factors]

### Recruitment
- Target: 6-8 participants
- Incentive: $[X] gift card
- Channels: [How to recruit]

### Interview Guide
- Duration: 45-60 minutes
- Format: Video call / In-person

### Logistics
- Researcher: [Name]
- Note-taker: [Name]
- Recording: [Consent process]
```

### Interview Structure

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

### Interview Best Practices

| Do | Don't |
|----|-------|
| Ask open-ended questions | Ask leading questions |
| Listen more than talk | Interrupt or fill silences |
| Follow interesting threads | Stick rigidly to script |
| Ask "why" and "how" | Accept surface answers |
| Take verbatim notes | Paraphrase or interpret |

## Usability Testing

### Test Plan Template

```markdown
## Usability Test Plan

### Objective
[What we're trying to learn]

### Prototype/Product
- Version: [Link or description]
- Fidelity: Low / Medium / High
- Platform: Desktop / Mobile / Both

### Participants
- Target: 5-10 users
- Criteria: [Who qualifies]
- Recruitment: [Method]

### Tasks
1. [Task 1]: Success criteria
2. [Task 2]: Success criteria
3. [Task 3]: Success criteria

### Metrics
- Task completion rate
- Time on task
- Error rate
- SUS score (post-test)
- Qualitative observations
```

### Task Design

```markdown
## Task: Find and purchase a specific product

### Scenario
"You're looking for a birthday gift for your friend who loves
coffee. Find a pour-over coffee maker under $50 and complete
the checkout process."

### Success Criteria
- [ ] Found coffee maker category
- [ ] Applied price filter
- [ ] Selected appropriate product
- [ ] Added to cart
- [ ] Reached checkout confirmation

### Observation Points
- Navigation path taken
- Hesitation points
- Questions asked
- Errors made
```

### Thinking Aloud Protocol

**Facilitator Script:**
```
"As you work through each task, please think out loud.
Tell me what you're looking at, what you're trying to do,
and what you're thinking. There are no wrong answers—
we're testing the design, not you."
```

## Surveys

### Survey Design Principles

| Principle | Application |
|-----------|-------------|
| Keep it short | 5-10 minutes max |
| Lead with easy questions | Demographics last |
| Use clear language | Avoid jargon |
| Balance question types | Mix scales, multiple choice, open-ended |
| Test before sending | Pilot with 3-5 people |

### Question Types

**Rating Scales:**
```
How satisfied are you with [product]?
○ Very dissatisfied (1)
○ Dissatisfied (2)
○ Neutral (3)
○ Satisfied (4)
○ Very satisfied (5)
```

**NPS:**
```
How likely are you to recommend [product] to a friend?
0  1  2  3  4  5  6  7  8  9  10
○  ○  ○  ○  ○  ○  ○  ○  ○  ○  ○
Not at all likely         Extremely likely

[Detractors: 0-6] [Passives: 7-8] [Promoters: 9-10]
NPS = % Promoters - % Detractors
```

**System Usability Scale (SUS):**
```markdown
10 questions, 5-point scale (Strongly disagree → Strongly agree)

1. I think I would like to use this system frequently
2. I found the system unnecessarily complex
3. I thought the system was easy to use
...

SUS Score = ((Sum of odd Qs - 5) + (25 - Sum of even Qs)) × 2.5
Range: 0-100, Average: 68
```

## Card Sorting

### Types

| Type | Description | When to Use |
|------|-------------|-------------|
| **Open** | Users create their own categories | Early IA exploration |
| **Closed** | Users sort into predefined categories | Validate proposed IA |
| **Hybrid** | Users can add categories | Balance of both |

### Card Sorting Process

```markdown
## Card Sort: [Project Name]

### Cards (Items to Sort)
1. Account settings
2. Billing history
3. Change password
4. Team members
... [30-50 cards typical]

### Categories (Closed Sort)
- Profile
- Settings
- Team
- Billing
- Help

### Analysis
- Agreement matrix (how often items grouped together)
- Dendrograms (hierarchical clustering)
- Category confusion (items frequently misplaced)
```

### Analyzing Results

```
Agreement Matrix (% of participants who grouped together)

              Settings  Profile  Billing
Change PW        85%      15%       0%
Team mgmt        10%      20%      70%
Payment info      5%       0%      95%
```

##  Research Trends

- **AI-assisted analysis**: NLP for interview transcription and theme extraction
- **Unmoderated at scale**: Remote testing platforms enable larger samples
- **Continuous research**: Embedded research in product development cycles
- **Mixed methods**: Combining qual and quant in single studies
- **Accessibility focus**: Including users with disabilities by default

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
- [Supporting metric]

### Implications
- Product: [What to build/change]
- Design: [UX recommendation]
- Strategy: [Business consideration]

### Related Findings
- [Link to related research]
```

## Related Skills

- `persona-journey-mapping` - Synthesizing research into personas
- `requirements-engineering` - Translating insights to requirements
- `product-strategy-frameworks` - Strategic context for research

## References

- [Interview Guide Template](references/interview-guide-template.md)
- [Survey Question Bank](references/survey-question-bank.md)

**Version:** 1.0.0 (January )
