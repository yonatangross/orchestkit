---
name: persona-journey-mapping
description: User personas, customer journey maps, empathy maps, and experience mapping patterns. Use when synthesizing research into actionable models, understanding user experiences, or aligning teams on customer needs.
context: fork
agent: ux-researcher
version: 1.0.0
tags: [ux, personas, journey-map, empathy-map, experience]
author: OrchestKit
user-invocable: false
complexity: medium
---

# Persona & Journey Mapping

Frameworks for synthesizing research into actionable user models and experience maps.

## User Personas

### Persona vs. Empathy Map

| Aspect | Persona | Empathy Map |
|--------|---------|-------------|
| Based on | Fictional composite | Real individuals |
| Scope | Full user profile | Specific moment/scenario |
| Purpose | Shared understanding | Build empathy quickly |
| Creation | After research synthesis | During/after research |

### Persona Template

```markdown
## Persona: [Name]

### Photo & Demographics
[Include representative image]
- Age: [Range]
- Role: [Job title]
- Company: [Type/size]
- Location: [Geographic]
- Tech savviness: [Low/Medium/High]

### Quote
> "[Characteristic statement that captures their mindset]"

### Background
[2-3 sentences about their professional context]

### Goals
1. [Primary goal - what success looks like]
2. [Secondary goal]
3. [Tertiary goal]

### Pain Points
1. [Frustration with current state]
2. [Obstacle they face]
3. [Risk or concern]

### Behaviors
- [Typical workflow or habit]
- [Tool preferences]
- [Information sources]

### Motivations
- [What drives their decisions]
- [What they value most]

### Scenario
[Brief story of how they might use your product]

### Key Insight
[The most important thing to remember about this persona]
```

### Persona Example

```markdown
## Persona: DevOps Dana

### Demographics
- Age: 32
- Role: Senior DevOps Engineer
- Company: Mid-size SaaS (200 employees)
- Location: Austin, TX
- Tech savviness: Expert

### Quote
> "I don't have time for tools that create more work than they save."

### Background
Dana manages CI/CD pipelines and infrastructure for a growing
engineering team. She's responsible for reliability and developer
productivity, and is constantly balancing new requests with
maintaining existing systems.

### Goals
1. Reduce deployment failures and rollback frequency
2. Give developers self-service capabilities without chaos
3. Spend less time on repetitive tasks, more on improvements

### Pain Points
1. Alert fatigue from too many false positives
2. Lack of visibility into who changed what and when
3. Context switching between 10+ different tools

### Behaviors
- Checks Slack and monitoring dashboards first thing
- Automates anything she does more than twice
- Documents decisions in ADRs and runbooks

### Motivations
- Professional reputation for reliability
- Autonomy to solve problems her way
- Continuous learning and skill growth

### Key Insight
Dana evaluates tools by "time saved vs. time invested"—she needs
immediate value with minimal onboarding.
```

## Empathy Maps

### Standard Empathy Map

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                     [User/Persona]                      │
│                                                         │
├─────────────────────────┬───────────────────────────────┤
│         SAYS            │            THINKS             │
│                         │                               │
│ • Direct quotes         │ • What occupies their mind    │
│ • Statements made       │ • Worries and concerns        │
│ • Questions asked       │ • Aspirations                 │
│                         │                               │
├─────────────────────────┼───────────────────────────────┤
│         DOES            │            FEELS              │
│                         │                               │
│ • Observable actions    │ • Emotional state             │
│ • Behaviors             │ • Frustrations                │
│ • Workarounds           │ • Delights                    │
│                         │                               │
└─────────────────────────┴───────────────────────────────┘
│                         │                               │
│         PAINS           │            GAINS              │
│                         │                               │
│ • Fears                 │ • Wants                       │
│ • Frustrations          │ • Needs                       │
│ • Obstacles             │ • Success measures            │
│                         │                               │
└─────────────────────────┴───────────────────────────────┘
```

### Empathy Map Example

```markdown
## Empathy Map: First-time user during onboarding

### Context
New user who just signed up, attempting to complete setup

### SAYS
- "Where do I start?"
- "Is there a tutorial?"
- "Can I import my existing data?"

### THINKS
- "Is this going to be worth my time?"
- "I hope I don't break anything"
- "How long until I see value?"

### DOES
- Clicks around hesitantly
- Opens help docs in new tab
- Looks for "Get Started" or "Quick Start"
- Skips optional steps

### FEELS
- Anxious about learning curve
- Hopeful about solving their problem
- Impatient to see results
- Overwhelmed by options

### PAINS
- Information overload
- Unclear next steps
- Fear of making wrong choices early

### GAINS
- Quick win / early success
- Confidence in the tool
- Clear path to full value
```

## Customer Journey Maps

### Journey Map Structure

```
┌────────────────────────────────────────────────────────────────┐
│                     CUSTOMER JOURNEY MAP                        │
│                      [Journey Name]                             │
├────────┬─────────┬─────────┬─────────┬─────────┬───────────────┤
│ STAGE  │ Aware   │ Consider│ Purchase│ Onboard │ Use & Retain  │
├────────┼─────────┼─────────┼─────────┼─────────┼───────────────┤
│ DOING  │         │         │         │         │               │
├────────┼─────────┼─────────┼─────────┼─────────┼───────────────┤
│THINKING│         │         │         │         │               │
├────────┼─────────┼─────────┼─────────┼─────────┼───────────────┤
│FEELING │  😐     │   🤔    │   😬    │   😊    │      😃       │
├────────┼─────────┼─────────┼─────────┼─────────┼───────────────┤
│  PAIN  │         │         │         │         │               │
│ POINTS │         │         │         │         │               │
├────────┼─────────┼─────────┼─────────┼─────────┼───────────────┤
│ OPPORT-│         │         │         │         │               │
│ UNITIES│         │         │         │         │               │
├────────┼─────────┼─────────┼─────────┼─────────┼───────────────┤
│TOUCH-  │ Blog,   │ Demo,   │ Sales,  │ Email,  │ App, Support, │
│POINTS  │ Social  │ Reviews │ Pricing │ Docs    │ Community     │
└────────┴─────────┴─────────┴─────────┴─────────┴───────────────┘
```

### Journey Map Template

```markdown
## Journey Map: [Journey Name]

### Persona
[Which persona is this journey for]

### Scenario
[What is the user trying to accomplish]

### Stages

#### Stage 1: [Name]

**Touchpoints:**
- [Channel/interaction point]

**Actions:**
- [What user does]

**Thoughts:**
- "[What they're thinking]"

**Emotions:** [😊 😐 😟]

**Pain Points:**
- [Friction or frustration]

**Opportunities:**
- [How we can improve]

---

#### Stage 2: [Name]
[Repeat structure]

---

### Key Insights
1. [Insight from mapping process]
2. [Another insight]

### Priority Improvements
| Stage | Opportunity | Impact | Effort |
|-------|-------------|--------|--------|
| | | | |
```

### Experience Curve

```
Emotional Journey: First Month with Product

Satisfaction
    │
 😃 │                              ╭────────────
    │                        ╭────╯  Productive
 😊 │                   ╭────╯       User
    │              ╭────╯
 😐 │     ╭────────╯
    │ ╭───╯   Pit of          Climbing
 😟 │ │       Despair          Out
    │─╯
    └──────────────────────────────────────────► Time
      Day 1   Week 1   Week 2   Week 3   Week 4
```

## Service Blueprint

Extension of journey map showing frontstage/backstage operations.

```
┌─────────────────────────────────────────────────────────┐
│ CUSTOMER ACTIONS    │  Browse  │  Sign up │  Onboard   │
├─────────────────────┼──────────┼──────────┼────────────┤
│ LINE OF INTERACTION │──────────┼──────────┼────────────┤
├─────────────────────┼──────────┼──────────┼────────────┤
│ FRONTSTAGE         │ Website  │  Form    │  Welcome   │
│ (Visible)          │          │          │  wizard    │
├─────────────────────┼──────────┼──────────┼────────────┤
│ LINE OF VISIBILITY │──────────┼──────────┼────────────┤
├─────────────────────┼──────────┼──────────┼────────────┤
│ BACKSTAGE          │ CDN,     │ Auth     │  Data      │
│ (Invisible)        │ Analytics│ system   │  import    │
├─────────────────────┼──────────┼──────────┼────────────┤
│ SUPPORT PROCESSES  │ Hosting, │ Email    │ Customer   │
│                    │ CMS      │ provider │ success    │
└─────────────────────┴──────────┴──────────┴────────────┘
```

## When to Use Each Tool

| Tool | Best For | Timing |
|------|----------|--------|
| Persona | Shared understanding of target users | After discovery research |
| Empathy Map | Quick alignment on specific scenario | During workshops |
| Journey Map | End-to-end experience analysis | Strategic planning |
| Service Blueprint | Operations alignment with CX | Process improvement |

## Living Documents

These artifacts should evolve:

```markdown
## Maintenance Schedule

### Personas
- Review: Quarterly
- Full update: Annually or after major pivot

### Journey Maps
- Review: After major feature launches
- Full update: When customer journey fundamentally changes

### Empathy Maps
- Create fresh for each new scenario/project
- Archive after project completion
```

##  Best Practices

- **Data-backed personas**: Connect to analytics, not just qualitative research
- **Dynamic journeys**: Update based on real user behavior data
- **Cross-functional creation**: Include engineering, support, sales in workshops
- **Accessibility by default**: Include users with disabilities in all personas
- **Connect to metrics**: Link journey stages to measurable KPIs

## Related Skills

- `user-research-methods` - Research that feeds into personas/journeys
- `product-strategy-frameworks` - Strategic context for experience design
- `requirements-engineering` - Translating insights to requirements

## References

- [Persona Template](references/persona-template.md)
- [Journey Map Workshop Guide](references/journey-map-workshop.md)

**Version:** 1.0.0 (January )
