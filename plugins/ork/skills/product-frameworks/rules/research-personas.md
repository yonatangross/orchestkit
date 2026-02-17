---
title: "Research: User Personas & Empathy Maps"
category: research
impact: HIGH
impactDescription: "Ensures data-backed user personas with clear goals, pain points, and behavioral patterns for product alignment"
tags: personas, empathy-map, user-research, target-users
---

# User Personas & Empathy Maps

Frameworks for synthesizing research into actionable user models.

## Persona Template

```markdown
## Persona: [Name]

### Demographics
- Age: [Range]
- Role: [Job title]
- Company: [Type/size]
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

### Key Insight
[The most important thing to remember about this persona]
```

## Persona Example

```markdown
## Persona: DevOps Dana

### Demographics
- Age: 32
- Role: Senior DevOps Engineer
- Company: Mid-size SaaS (200 employees)
- Tech savviness: Expert

### Quote
> "I don't have time for tools that create more work than they save."

### Background
Dana manages CI/CD pipelines and infrastructure for a growing
engineering team. She's responsible for reliability and developer
productivity.

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

### Key Insight
Dana evaluates tools by "time saved vs. time invested" -- she needs
immediate value with minimal onboarding.
```

## Empathy Map

```
+-------------------------+-------------------------------+
|         SAYS            |            THINKS             |
| * Direct quotes         | * What occupies their mind    |
| * Statements made       | * Worries and concerns        |
| * Questions asked       | * Aspirations                 |
+-------------------------+-------------------------------+
|         DOES            |            FEELS              |
| * Observable actions    | * Emotional state             |
| * Behaviors             | * Frustrations                |
| * Workarounds           | * Delights                    |
+-------------------------+-------------------------------+
|         PAINS           |            GAINS              |
| * Fears                 | * Wants                       |
| * Frustrations          | * Needs                       |
| * Obstacles             | * Success measures            |
+-------------------------+-------------------------------+
```

## Persona vs. Empathy Map

| Aspect | Persona | Empathy Map |
|--------|---------|-------------|
| Based on | Fictional composite | Real individuals |
| Scope | Full user profile | Specific moment/scenario |
| Purpose | Shared understanding | Build empathy quickly |
| Creation | After research synthesis | During/after research |

## Maintenance Schedule

### Personas
- Review: Quarterly
- Full update: Annually or after major pivot

### Empathy Maps
- Create fresh for each new scenario/project
- Archive after project completion

## Best Practices

- **Data-backed personas**: Connect to analytics, not just qualitative research
- **Cross-functional creation**: Include engineering, support, sales in workshops
- **Accessibility by default**: Include users with disabilities in all personas
- **Connect to metrics**: Link persona needs to measurable KPIs
- **3-5 personas max**: Too many dilutes focus

**Incorrect — Vague persona without goals:**
```markdown
Persona: Sarah
Age: 35
Job: Marketing Manager
Likes: Social media, coffee
```

**Correct — Actionable persona with goals and pain points:**
```markdown
Persona: DevOps Dana
Quote: "I don't have time for tools that create more work than they save."
Goals:
1. Reduce deployment failures
2. Give developers self-service
Pain Points:
1. Alert fatigue from false positives
2. Context switching between 10+ tools
```
