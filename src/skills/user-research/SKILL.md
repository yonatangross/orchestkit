---
name: user-research
license: MIT
compatibility: "Claude Code 2.1.76+."
description: "User personas, customer journey maps, interview guides, usability testing, and card sorting. Use when building user understanding, mapping customer experiences, planning user research sessions, or defining Jobs-to-Be-Done."
tags: [persona, journey-map, user-interview, usability, jtbd, card-sort, empathy-map, research]
context: fork
agent: product-strategist
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
persuasion-type: collaborative
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# User Research

Frameworks for building deep user understanding through structured research methods. Covers personas, journey mapping, interviews, usability testing, and Jobs-to-be-Done.

## Research Method Selection

Choose the right method for your question:

| Method | When to Use | Sample Size | Time | Output |
|--------|-------------|-------------|------|--------|
| User Interviews | Early discovery, deep understanding | 5-8 | 2-3 weeks | Qualitative insights |
| Usability Testing | Validate designs, find issues | 5-10 | 1-2 weeks | Actionable fixes |
| Surveys | Quantify attitudes, preferences | 100+ | 1-2 weeks | Statistical data |
| Card Sorting | Information architecture | 15-30 | 1 week | IA recommendations |
| A/B Testing | Compare alternatives | 1000+ | 2-4 weeks | Statistical winner |

**Rule of thumb:** Start with interviews (5-8 participants) to discover unknowns. Switch to surveys once you have hypotheses to validate.

## Persona Quick Reference

Personas are fictional composites built from research synthesis. Keep to 3-5 max.

```markdown
## Persona: [Name]

### Demographics
- Age: [Range]
- Role: [Job title]
- Company: [Type/size]
- Tech savviness: [Low/Medium/High]

### Quote
> "[Characteristic statement that captures their mindset]"

### Goals
1. [Primary goal - what success looks like]
2. [Secondary goal]

### Pain Points
1. [Frustration with current state]
2. [Obstacle they face]

### Key Insight
[The most important thing to remember about this persona]
```

**Incorrect — vague persona without goals:**
```markdown
Persona: Sarah, Age 35, Marketing Manager. Likes social media and coffee.
```

**Correct — actionable persona with goals and pain points:**
```markdown
Persona: DevOps Dana
Quote: "I don't have time for tools that create more work than they save."
Goals: Reduce deployment failures, give devs self-service capabilities
Pain Points: Alert fatigue from false positives, context-switching between 10+ tools
Key Insight: Evaluates tools by "time saved vs. time invested" — needs immediate value.
```

## Journey Map Structure

Maps the end-to-end experience for a specific persona and scenario.

```markdown
## Journey Map: [Journey Name]

### Persona + Scenario
[Which persona | What they're trying to accomplish]

### Stages: Aware → Consider → Purchase → Onboard → Use → Retain

For each stage:
- **Touchpoints:** [Channel/interaction point]
- **Actions:** [What user does]
- **Emotions:** [Satisfied / Neutral / Frustrated]
- **Pain Points:** [Friction]
- **Opportunities:** [How we improve]
```

Common B2B SaaS stages: `Awareness → Evaluation → Purchase → Onboarding → Adoption → Expansion → Advocacy/Churn`

## JTBD Framework

People don't buy products — they hire them to do specific jobs.

**JTBD Statement Format:**
```
When [situation], I want to [motivation], so I can [expected outcome].
```

**Example:**
```
When I'm preparing for a board review, I want to quickly see revenue trends,
so I can answer questions confidently without scrambling for data.
```

**Job Dimensions:**
| Dimension | Description |
|-----------|-------------|
| Functional | Practical task to accomplish |
| Emotional | How the user wants to feel |
| Social | How the user wants to be perceived |

**Opportunity Score:** `Importance + (Importance - Satisfaction)` — scores > 10 indicate high-opportunity areas.

## Empathy Map

Quick tool for building shared understanding in workshops:

```
+-------------------------+-------------------------------+
|         SAYS            |            THINKS             |
| Direct quotes           | Worries and concerns          |
| Questions asked         | Aspirations                   |
+-------------------------+-------------------------------+
|         DOES            |            FEELS              |
| Observable actions      | Emotional state               |
| Workarounds             | Frustrations and delights     |
+-------------------------+-------------------------------+
|         PAINS           |            GAINS              |
| Fears and obstacles     | Wants and needs               |
+-------------------------+-------------------------------+
```

## Interview Best Practices

| Do | Don't |
|----|-------|
| Ask open-ended questions | Ask leading questions |
| Ask "why" and "how" | Accept surface answers |
| Follow interesting threads | Stick rigidly to script |
| Take verbatim notes | Paraphrase or interpret |

**Standard interview arc:** Warm-up (5 min) → Context setting (10 min) → Deep dive (25 min) → Wrap-up (5 min)

## Rules (Load On-Demand)

Read these files for detailed guidance:
- [research-personas.md](rules/research-personas.md) — Persona template, empathy map, maintenance schedule
- [research-journey-mapping.md](rules/research-journey-mapping.md) — Journey map template, service blueprints, experience curves
- [research-user-interviews.md](rules/research-user-interviews.md) — Interview structure, usability testing, NPS/SUS, card sorting

## References

- [interview-guide-template.md](references/interview-guide-template.md) — Ready-to-use interview guide template
- [journey-map-workshop.md](references/journey-map-workshop.md) — Workshop facilitation guide
- [user-story-workshop-guide.md](references/user-story-workshop-guide.md) — User story writing workshop

## Related Skills

- `ork:write-prd` — Translate research insights into structured product requirements
- `ork:product-frameworks` — Full PM framework suite (business cases, prioritization, metrics, OKRs)

---

**Version:** 1.0.0
