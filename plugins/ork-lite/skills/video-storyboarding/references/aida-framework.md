# AIDA Framework Deep Dive

Comprehensive guide to applying the AIDA marketing framework for tech demo videos.

## Framework Origins

AIDA (Attention, Interest, Desire, Action) was developed by advertising pioneer E. St. Elmo Lewis in 1898. It remains the foundation of persuasive communication because it mirrors the natural decision-making process.

```
┌─────────────────────────────────────────────────────────────────┐
│                    COGNITIVE JOURNEY                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   AWARENESS        EVALUATION        DECISION        ACTION     │
│       │                │                │               │        │
│       ▼                ▼                ▼               ▼        │
│   ┌───────┐        ┌───────┐        ┌───────┐       ┌───────┐   │
│   │   A   │───────▶│   I   │───────▶│   D   │──────▶│   A   │   │
│   │       │        │       │        │       │       │       │   │
│   │Attn.  │        │Int.   │        │Desire │       │Action │   │
│   └───────┘        └───────┘        └───────┘       └───────┘   │
│       │                │                │               │        │
│  "What's this?"  "Tell me more"  "I want this"    "How do I     │
│                                                    get it?"      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Phase 1: Attention (A)

### Psychology

The human brain processes visual information in 13 milliseconds. You have less than 3 seconds to capture attention before viewers scroll past.

### Attention Triggers

```yaml
pattern_interrupts:
  visual:
    - "Unexpected motion direction"
    - "High contrast elements"
    - "Human faces (especially eyes)"
    - "Bright, saturated colors"
    - "Large text on minimal background"

  auditory:
    - "Sudden sound (use sparingly)"
    - "Voice change in tone"
    - "Music tempo shift"
    - "Strategic silence"

  cognitive:
    - "Provocative question"
    - "Surprising statistic"
    - "Contradiction to expectation"
    - "Incomplete pattern (curiosity gap)"
```

### Hook Formulas

```
┌─────────────────────────────────────────────────────────────────┐
│                      HOOK TEMPLATES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  THE QUESTION HOOK                                               │
│  "What if [impossible-sounding benefit]?"                        │
│  Example: "What if your AI never forgot a pattern?"              │
│                                                                  │
│  THE STATISTIC HOOK                                              │
│  "[Large number] [impressive thing]"                             │
│  Example: "179 skills. One command."                             │
│                                                                  │
│  THE PAIN HOOK                                                   │
│  "Stop [frustrating activity]"                                   │
│  Example: "Stop rewriting the same prompts"                      │
│                                                                  │
│  THE TRANSFORMATION HOOK                                         │
│  "From [bad state] to [good state] in [short time]"              │
│  Example: "From chaos to organized in 30 seconds"                │
│                                                                  │
│  THE CURIOSITY HOOK                                              │
│  "The [unexpected thing] about [familiar topic]"                 │
│  Example: "The hidden power inside Claude Code"                  │
│                                                                  │
│  THE SOCIAL PROOF HOOK                                           │
│  "[Number] developers discovered [benefit]"                      │
│  Example: "Why top developers use skill libraries"               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Visual Attention Techniques

```
Eye Movement Patterns:

┌─────────────────────────────────────┐
│                                     │
│   1 ─────────────────▶ 2           │  F-Pattern (text-heavy)
│   │                                 │
│   ▼                                 │
│   3 ─────────────▶ 4               │
│   │                                 │
│   ▼                                 │
│   5 ─────▶ 6                       │
│                                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│                                     │
│         1                           │  Z-Pattern (visual-heavy)
│          ╲                          │
│           ╲                         │
│            ╲──────▶ 2              │
│             ╲                       │
│              ╲                      │
│          3 ◀──╲                    │
│                ╲──────▶ 4          │
│                                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│                                     │
│              ┌───┐                  │  Center Focus
│              │ 1 │                  │  (hero element)
│              └───┘                  │
│                │                    │
│       ┌───────┼───────┐            │
│       ▼       ▼       ▼            │
│      [2]     [3]     [4]           │
│                                     │
└─────────────────────────────────────┘
```

## Phase 2: Interest (I)

### Psychology

Once attention is captured, the brain asks "Is this relevant to me?" You must quickly establish relevance through problem recognition.

### The Problem-Solution Bridge

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTEREST ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   PROBLEM STATEMENT          BRIDGE            SOLUTION          │
│   (Pain Recognition)      (Transition)      (Your Product)       │
│                                                                  │
│   ┌─────────────────┐    ┌───────────┐    ┌─────────────────┐   │
│   │                 │    │           │    │                 │   │
│   │  "Every time    │    │ "There's  │    │ "OrchestKit     │   │
│   │   you start a   │───▶│  a better │───▶│  gives Claude   │   │
│   │   new session,  │    │  way..."  │    │  instant        │   │
│   │   Claude        │    │           │    │  access to      │   │
│   │   forgets..."   │    │           │    │  179 skills"    │   │
│   │                 │    │           │    │                 │   │
│   └─────────────────┘    └───────────┘    └─────────────────┘   │
│                                                                  │
│        10-15s                3-5s              15-20s            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Problem Articulation Techniques

```yaml
problem_frameworks:

  pains_and_gains:
    current_pain: "What frustrates your audience?"
    desired_gain: "What outcome do they want?"
    gap: "What's stopping them?"

  before_after:
    before:
      situation: "Describe current state"
      emotion: "Frustration, confusion, wasted time"
      cost: "What are they losing?"
    after:
      situation: "Describe improved state"
      emotion: "Confidence, efficiency, satisfaction"
      gain: "What do they get?"

  the_villain:
    enemy: "What external force causes the problem?"
    victim: "Your audience"
    hero: "Your product"
    weapon: "Key feature that defeats the villain"
```

### Feature Prioritization

```
┌─────────────────────────────────────────────────────────────────┐
│                    FEATURE PRIORITY MATRIX                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│           HIGH UNIQUENESS                                        │
│                 │                                                │
│    MENTION     │     HIGHLIGHT                                   │
│    BRIEFLY     │     PROMINENTLY                                 │
│                │                                                 │
│  ─────────────┼───────────────── HIGH VALUE                     │
│                │                                                 │
│    SKIP       │     MENTION                                      │
│    ENTIRELY   │     IF TIME                                      │
│                │                                                 │
│           LOW UNIQUENESS                                         │
│                                                                  │
│  Example placement for OrchestKit:                               │
│                                                                  │
│  HIGHLIGHT:     Parallel agents, 179 skills, quality hooks      │
│  MENTION:       Task management, skill auto-suggest              │
│  IF TIME:       GitHub integration                               │
│  SKIP:          Basic file operations                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Phase 3: Desire (D)

### Psychology

Interest establishes relevance; desire creates emotional investment. The viewer must transition from "That's useful" to "I need this."

### Building Desire

```yaml
desire_triggers:

  transformation_promise:
    description: "Show the end state, not the process"
    example: "See your workflow transform from chaotic to organized"
    visual: "Before/after comparison"

  social_proof:
    description: "Others trust this, so can you"
    types:
      - "User counts (active users, downloads)"
      - "Authority endorsements"
      - "Peer usage (companies, developers)"
      - "Metrics (GitHub stars, npm downloads)"

  scarcity:
    description: "Limited availability increases perceived value"
    note: "Use authentically - false scarcity damages trust"
    examples:
      - "Early adopter features"
      - "Community-exclusive content"

  fear_of_missing_out:
    description: "Everyone else is benefiting"
    example: "Join 1000+ developers already using OrchestKit"

  future_pacing:
    description: "Help viewer imagine using the product"
    example: "Imagine starting every session with perfect context..."
```

### Proof Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                      PROOF STRENGTH                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STRONGEST                                                       │
│     │                                                            │
│     │    ┌─────────────────────────────────────────────────┐    │
│     ├───▶│  Live demo showing actual results               │    │
│     │    └─────────────────────────────────────────────────┘    │
│     │                                                            │
│     │    ┌─────────────────────────────────────────────────┐    │
│     ├───▶│  Specific, verifiable metrics                   │    │
│     │    └─────────────────────────────────────────────────┘    │
│     │                                                            │
│     │    ┌─────────────────────────────────────────────────┐    │
│     ├───▶│  Named user testimonials                        │    │
│     │    └─────────────────────────────────────────────────┘    │
│     │                                                            │
│     │    ┌─────────────────────────────────────────────────┐    │
│     ├───▶│  Third-party validation (reviews, awards)       │    │
│     │    └─────────────────────────────────────────────────┘    │
│     │                                                            │
│     │    ┌─────────────────────────────────────────────────┐    │
│     ├───▶│  Aggregate user counts                          │    │
│     │    └─────────────────────────────────────────────────┘    │
│     │                                                            │
│     │    ┌─────────────────────────────────────────────────┐    │
│     └───▶│  Self-proclaimed benefits (weakest)             │    │
│          └─────────────────────────────────────────────────┘    │
│  WEAKEST                                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Emotional Resonance

```yaml
emotional_chords:

  competence:
    trigger: "I'll be better at my job"
    messaging: "Write production-ready code faster"
    visual: "Complex task completed effortlessly"

  belonging:
    trigger: "I'll be part of something"
    messaging: "Join the developer community"
    visual: "Community activity, contributor recognition"

  efficiency:
    trigger: "I'll save time and effort"
    messaging: "Stop reinventing patterns"
    visual: "Time comparisons, automation"

  mastery:
    trigger: "I'll have more control"
    messaging: "Customize every aspect"
    visual: "Configuration options, extensibility"

  security:
    trigger: "I won't make mistakes"
    messaging: "Built-in quality gates catch issues"
    visual: "Error prevention, validation success"
```

## Phase 4: Action (A)

### Psychology

All persuasion leads to this moment. The transition from desire to action requires removing friction and providing clear direction.

### CTA Design Principles

```
┌─────────────────────────────────────────────────────────────────┐
│                    EFFECTIVE CTA ANATOMY                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   │           "Add to Claude Code"                          │   │
│   │                                                         │   │
│   │   ┌─────────────────────────────────────────────────┐   │   │
│   │   │  claude mcp add orchestkit                      │   │   │
│   │   └─────────────────────────────────────────────────┘   │   │
│   │                                                         │   │
│   │           Takes 30 seconds                              │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   COMPONENTS:                                                    │
│   • Clear verb: "Add" (not "Learn more" or "Get started")       │
│   • Specific action: Exact command to run                        │
│   • Effort reduction: "30 seconds" removes time objection        │
│   • High contrast: Visually prominent                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Friction Removal

```yaml
friction_points:

  cognitive:
    problem: "Too many options"
    solution: "Single, clear CTA"

  temporal:
    problem: "Seems time-consuming"
    solution: "Specify short time (30 seconds)"

  technical:
    problem: "Might be complicated"
    solution: "Show simple command"

  trust:
    problem: "Is this safe?"
    solution: "Open source, official channels"

  reversibility:
    problem: "What if I don't like it?"
    solution: "Easy to remove, no lock-in"
```

### Secondary CTAs

```
Primary CTA:   Install the product
Secondary:     Learn more / documentation
Tertiary:      Follow / subscribe

Visual hierarchy should match importance:
┌─────────────────────────────────┐
│   ████████████████████████████  │  ← Primary (100% prominence)
│        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓           │  ← Secondary (60% prominence)
│              ░░░░░░░             │  ← Tertiary (30% prominence)
└─────────────────────────────────┘
```

## AIDA Timing Ratios

### Standard Distribution

```
┌─────────────────────────────────────────────────────────────────┐
│                    TIMING TEMPLATES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STANDARD (15-35-35-15):                                         │
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  A:15%        I:35%              D:35%              A:15%        │
│                                                                  │
│  PROBLEM-HEAVY (10-45-30-15):                                    │
│  ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  A:10%           I:45%              D:30%           A:15%        │
│  Use when: Problem is complex and needs explanation              │
│                                                                  │
│  DEMO-HEAVY (15-25-45-15):                                       │
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  A:15%     I:25%                  D:45%             A:15%        │
│  Use when: Product speaks for itself in demo                     │
│                                                                  │
│  AWARENESS (20-40-25-15):                                        │
│  █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  A:20%          I:40%            D:25%              A:15%        │
│  Use when: Introducing new category/concept                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Common AIDA Mistakes

### Anti-Patterns

```yaml
mistakes:

  attention:
    - mistake: "Logo animation as first frame"
      fix: "Start with hook, logo at end"

    - mistake: "Slow fade in"
      fix: "Hard cut to action"

    - mistake: "Generic stock footage"
      fix: "Custom visuals, product shots"

  interest:
    - mistake: "Features without context"
      fix: "Problem before solution"

    - mistake: "Too many features"
      fix: "3-4 max, prioritize unique ones"

    - mistake: "Jargon-heavy explanation"
      fix: "Benefits over specifications"

  desire:
    - mistake: "Unsubstantiated claims"
      fix: "Specific, verifiable proof"

    - mistake: "No emotional connection"
      fix: "Show transformation, not just product"

    - mistake: "Talking about yourself"
      fix: "Talk about viewer's outcomes"

  action:
    - mistake: "Multiple CTAs"
      fix: "One primary, one secondary max"

    - mistake: "Vague instruction"
      fix: "Exact command or next step"

    - mistake: "Hidden CTA"
      fix: "Visually prominent, repeated if needed"
```

## Platform-Specific AIDA

### Adaptation by Platform

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLATFORM ADJUSTMENTS                          │
├──────────────┬──────────────────────────────────────────────────┤
│  Platform    │  AIDA Modifications                              │
├──────────────┼──────────────────────────────────────────────────┤
│  Twitter/X   │  Attention: 3s max (auto-play muted)             │
│              │  Action: On-screen text essential                 │
│              │  Total: 30-45s optimal                            │
├──────────────┼──────────────────────────────────────────────────┤
│  LinkedIn    │  Interest: Can be longer (professional context)  │
│              │  Desire: Emphasize career/productivity benefits  │
│              │  Total: 60-90s optimal                            │
├──────────────┼──────────────────────────────────────────────────┤
│  YouTube     │  Attention: 5s before skip button                │
│              │  All phases can expand                            │
│              │  Total: 2-5 min for demos                         │
├──────────────┼──────────────────────────────────────────────────┤
│  Product Hunt│  Attention: Assume viewer knows category         │
│              │  Desire: Heavy focus on differentiation          │
│              │  Total: 60-90s optimal                            │
├──────────────┼──────────────────────────────────────────────────┤
│  GitHub      │  Silent-friendly (captions/text essential)       │
│              │  Interest: Technical depth appreciated            │
│              │  Total: 30-60s for README                         │
└──────────────┴──────────────────────────────────────────────────┘
```
