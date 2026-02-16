---
title: "Research: Journey Mapping & Service Blueprints"
category: research
impact: HIGH
impactDescription: "Ensures comprehensive customer experience mapping with touchpoints, pain points, and service operations visibility"
tags: journey-mapping, service-blueprint, customer-experience, touchpoints
---

# Journey Mapping & Service Blueprints

## Customer Journey Map Structure

```
+--------+---------+---------+---------+---------+---------------+
| STAGE  | Aware   | Consider| Purchase| Onboard | Use & Retain  |
+--------+---------+---------+---------+---------+---------------+
| DOING  |         |         |         |         |               |
+--------+---------+---------+---------+---------+---------------+
|THINKING|         |         |         |         |               |
+--------+---------+---------+---------+---------+---------------+
|FEELING | Neutral | Curious | Anxious | Hopeful | Satisfied     |
+--------+---------+---------+---------+---------+---------------+
|  PAIN  |         |         |         |         |               |
| POINTS |         |         |         |         |               |
+--------+---------+---------+---------+---------+---------------+
| OPPORT-|         |         |         |         |               |
| UNITIES|         |         |         |         |               |
+--------+---------+---------+---------+---------+---------------+
|TOUCH-  | Blog,   | Demo,   | Sales,  | Email,  | App, Support, |
|POINTS  | Social  | Reviews | Pricing | Docs    | Community     |
+--------+---------+---------+---------+---------+---------------+
```

## Journey Map Template

```markdown
## Journey Map: [Journey Name]

### Persona
[Which persona is this journey for]

### Scenario
[What is the user trying to accomplish]

### Stages

#### Stage 1: [Name]

**Touchpoints:** [Channel/interaction point]
**Actions:** [What user does]
**Thoughts:** "[What they're thinking]"
**Emotions:** [Satisfied / Neutral / Frustrated]
**Pain Points:** [Friction or frustration]
**Opportunities:** [How we can improve]

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

## Experience Curve

```
Emotional Journey: First Month with Product

Satisfaction
    |
    |                              +----------
    |                        +----/  Productive
    |                   +----/       User
    |              +----/
    |     +--------/
    | +---/   Pit of          Climbing
    | /       Despair          Out
    |-/
    +-----------------------------------------------> Time
      Day 1   Week 1   Week 2   Week 3   Week 4
```

## Service Blueprint

Extension of journey map showing frontstage/backstage operations.

```
+---------------------+----------+----------+------------+
| CUSTOMER ACTIONS    |  Browse  |  Sign up |  Onboard   |
+---------------------+----------+----------+------------+
| LINE OF INTERACTION |          |          |            |
+---------------------+----------+----------+------------+
| FRONTSTAGE         | Website  |  Form    |  Welcome   |
| (Visible)          |          |          |  wizard    |
+---------------------+----------+----------+------------+
| LINE OF VISIBILITY |          |          |            |
+---------------------+----------+----------+------------+
| BACKSTAGE          | CDN,     | Auth     |  Data      |
| (Invisible)        | Analytics| system   |  import    |
+---------------------+----------+----------+------------+
| SUPPORT PROCESSES  | Hosting, | Email    | Customer   |
|                    | CMS      | provider | success    |
+---------------------+----------+----------+------------+
```

## When to Use Each Tool

| Tool | Best For | Timing |
|------|----------|--------|
| Persona | Shared understanding of target users | After discovery research |
| Empathy Map | Quick alignment on specific scenario | During workshops |
| Journey Map | End-to-end experience analysis | Strategic planning |
| Service Blueprint | Operations alignment with CX | Process improvement |

## Common B2B SaaS Stages

```
Awareness -> Evaluation -> Purchase -> Onboarding ->
Adoption -> Expansion -> Advocacy/Churn
```

## Common B2C Stages

```
Discover -> Research -> Try -> Buy -> Use -> Share
```

## Best Practices

- **Dynamic journeys**: Update based on real user behavior data
- **Cross-functional creation**: Include engineering, support, sales in workshops
- **Connect to metrics**: Link journey stages to measurable KPIs
- **Review after major feature launches**: Journeys change with the product
