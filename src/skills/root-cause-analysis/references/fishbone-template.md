# Fishbone (Ishikawa) Diagram Guide

Comprehensive guide for multi-factor root cause analysis.

## When to Use Fishbone

| Good Fit | Poor Fit |
|----------|----------|
| Multiple potential causes | Single obvious cause |
| Cross-functional issues | Isolated technical bug |
| Process problems | Quick fix needed |
| Team brainstorming | Individual investigation |
| Quality issues | Time-sensitive incident |

## Fishbone Structure

```
                              ┌─────────────────┐
                              │                 │
        Category 1 ───────────┤                 │
         │                    │                 │
         ├─ Cause 1a          │                 │
         ├─ Cause 1b          │     PROBLEM     │
         └─ Cause 1c          │                 │
                              │                 │
        Category 2 ───────────┤                 │
         │                    │                 │
         ├─ Cause 2a          │                 │
         └─ Cause 2b          │                 │
                              │                 │
        Category 3 ───────────┤                 │
         │                    │                 │
         ├─ Cause 3a          │                 │
         ├─ Cause 3b          │                 │
         └─ Cause 3c          │                 │
                              └─────────────────┘
```

## Standard Category Sets

### Manufacturing (6 M's)
- **Man** (People)
- **Machine** (Equipment)
- **Method** (Process)
- **Material** (Inputs)
- **Measurement** (Data)
- **Mother Nature** (Environment)

### Software Development
- **Code** (Implementation)
- **Infrastructure** (Systems)
- **Dependencies** (External)
- **Configuration** (Settings)
- **Process** (Workflow)
- **People** (Human factors)

### Service Delivery
- **Product** (What we deliver)
- **Place** (Where/how delivered)
- **Price** (Cost factors)
- **Promotion** (Communication)
- **People** (Staff/training)
- **Process** (Operations)

## Workshop Process

### 1. Define the Problem (10 min)

Write in the "fish head":
```
PROBLEM: [Specific, measurable statement of what went wrong]

Examples:
- "API latency increased 10x for 2 hours"
- "Customer onboarding completion dropped from 70% to 45%"
- "Release was delayed by 3 weeks"
```

### 2. Select Categories (5 min)

Choose 4-6 categories appropriate to your problem:

For technical issues: Code, Infrastructure, Dependencies, Configuration, Process, People

For product issues: Design, Engineering, Data, Process, Communication, Resources

### 3. Brainstorm Causes (30 min)

**For each category, ask:**
- What in this category could cause the problem?
- Have we seen issues here before?
- What's changed recently in this area?

**Sticky Note Rules:**
- One cause per sticky note
- Be specific (not "bad code" but "missing input validation")
- Include evidence if available

### 4. Sub-Causes (15 min)

For major causes, drill down:

```
Infrastructure ──────────┐
    │                    │
    ├─ Database slow     │
    │   │                │
    │   ├─ Missing index │
    │   └─ No connection │
    │       pooling      │
    │                    │
    └─ Network issues    │
        │                │
        └─ Packet loss   │
```

### 5. Identify Root Causes (15 min)

**Vote on most likely root causes:**
- Each person gets 3 dots
- Vote on causes most likely to be root

**For each top-voted cause, ask:**
- Do we have evidence?
- Is this a symptom or root cause?
- If we fix this, would the problem be prevented?

### 6. Prioritize Actions (10 min)

| Root Cause | Impact | Effort | Priority |
|------------|--------|--------|----------|
| [Cause 1] | HIGH | LOW | Do First |
| [Cause 2] | HIGH | HIGH | Plan |
| [Cause 3] | LOW | LOW | Quick Win |

## Example: API Latency Spike

```
                              ┌─────────────────┐
                              │                 │
        Code ─────────────────┤                 │
         │                    │                 │
         ├─ N+1 query         │                 │
         ├─ Missing index     │                 │
         └─ Sync blocking     │   API LATENCY   │
                              │   SPIKE (10x)   │
  Infrastructure ─────────────┤                 │
         │                    │                 │
         ├─ DB connection pool│                 │
         ├─ Memory pressure   │                 │
         └─ Network saturation│                 │
                              │                 │
  Dependencies ───────────────┤                 │
         │                    │                 │
         ├─ External API slow │                 │
         ├─ Redis timeout     │                 │
         └─ CDN cache miss    │                 │
                              │                 │
  Configuration ──────────────┤                 │
         │                    │                 │
         ├─ Wrong timeout     │                 │
         └─ Missing env var   │                 │
                              └─────────────────┘

ROOT CAUSES IDENTIFIED:
1. N+1 query (HIGH impact, MEDIUM effort)
2. Missing index (HIGH impact, LOW effort) ← Fix first
3. External API slow (MEDIUM impact, needs escalation)
```

## Post-Analysis

- [ ] Document the diagram
- [ ] Create action items for root causes
- [ ] Share findings with team
- [ ] Schedule follow-up verification
- [ ] Add to knowledge base
