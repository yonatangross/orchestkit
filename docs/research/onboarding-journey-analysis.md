# OrchestKit Onboarding Journey Analysis

**Project:** OrchestKit — User Onboarding Friction Study
**Methodology:** Behavioral analysis + JTBD framework + journey mapping
**Date:** 2026-02-26
**Scope:** Discovery → First value (aha moment)

---

## 1. Key Finding Up Front

The aha moment for OrchestKit is when Claude silently does the right thing without being told. A hook blocks a bad commit. A skill applies cursor pagination automatically. The user did not ask for it — it just happened.

**The problem:** that moment currently arrives after a gauntlet of cognitive friction. The 3-plugin choice, the install command syntax, the counter-intuitive "Skills are just Markdown" model, and the missing "what now?" prompt after install all add up to a time-to-value that is far too long for a tool whose payoff is invisibility.

**Current estimated time-to-aha: 8–25 minutes depending on persona.**
**Target: under 3 minutes.**

---

## 2. Personas

### Persona A — "Full-Stack Farida"

**Role:** Senior full-stack engineer (Python backend + React frontend)
**Trigger:** Saw OrchestKit mentioned in a Claude Code thread or blog post
**Behavior:**
- Uses Claude Code daily, 2–4 hours/day
- Has already configured Claude with some custom instructions
- Will read the README top-to-bottom before installing anything
- Immediately suspicious of tools that "do too much"

**Goals:**
1. Understand what she is actually getting before committing to install
2. Know whether `ork` vs `orkl` matters for her stack
3. See value on the first real task, not just a health check

**Pain Points:**
1. "67 skills · 37 agents · 81 hooks" lands as noise — she does not know what a skill vs agent vs hook is in this context
2. The `orkl` vs `ork` split forces a decision she does not yet have the context to make
3. After `/ork:doctor` passes, she has no obvious next step — the tool is silent until she knows the right commands

**Key Quote (hypothesized):**
> "I spent 10 minutes reading the README and I still wasn't sure if I needed `ork` or `orkl`. I just guessed."

**Aha Moment:** She types `/ork:commit` and Claude runs tests, formats the commit message, and blocks a push to main — all without her explaining any of that. That is when she gets it.

---

### Persona B — "Backend-Only Ben"

**Role:** Backend engineer (Go or Python). No React, no LLM work.
**Trigger:** Colleague recommended it or saw a GitHub star spike
**Behavior:**
- CLI-first. Reads the Quick Start block only, then installs.
- Will run the install command before finishing the README.
- Does not read docs sites — uses `--help` flags.

**Goals:**
1. Install and forget. Wants automation to just work.
2. Does not want irrelevant React/LLM skills cluttering his Claude context.

**Pain Points:**
1. `orkl` vs `ork` is a real concern — but the description of `orkl` ("works for any stack") is too vague to be reassuring. He does not know if "any stack" means Go is well-supported or just tolerated.
2. He runs `/ork:doctor` and sees green — but he does not know what just got enabled. Nothing happened visibly.
3. He has no hook into his existing `git commit` workflow — he has to learn new slash commands.

**Key Quote (hypothesized):**
> "I installed it, ran doctor, it said everything was fine. Then I just... went back to what I was doing. I forgot it was there."

**Aha Moment:** He runs `git commit` and the pre-commit hook catches a secret he accidentally left in a file. That is the moment — but only if he notices the hook was the reason, not just luck.

---

### Persona C — "Curious Carlos"

**Role:** Developer who saw OrchestKit on Hacker News or Twitter. Has not committed to anything yet.
**Trigger:** Social proof — a real developer said it changed their workflow.
**Behavior:**
- Evaluating within 5 minutes. If he does not see the point, he closes the tab.
- Will not install something unless he understands what it does first.
- Wants a preview or demo, not a spec sheet.

**Goals:**
1. Understand what OrchestKit actually feels like before installing
2. Know whether it is worth the setup cost

**Pain Points:**
1. The README leads with tagline + numbers ("67 skills · 37 agents · 81 hooks") — numbers without meaning are not compelling to an evaluator.
2. There is no demo video, no interactive playground, no "try it in 30 seconds" path.
3. The docs link points to a full docs site — overwhelming for someone who just wants a taste.
4. The decision tree between `orkl`, `ork-creative`, and `ork` is confusing. Why are there three? Is creative something he needs?

**Key Quote (hypothesized):**
> "I wanted to see what it actually looks like when it works. I got a table of counts."

**Aha Moment for Carlos:** May never arrive unless there is a "try before install" path — a short video or animated demo of a hook catching something or a skill running.

---

### Persona D — "Team Lead Tina"

**Role:** Engineering manager or lead wanting to standardize team workflows.
**Trigger:** Saw a team member using it and wants to roll it out.
**Behavior:**
- Evaluates for security and maintainability first, then UX.
- Will check the LICENSE, the GitHub activity, the CHANGELOG.
- Wants a command she can put in the team onboarding doc.

**Goals:**
1. One install command the whole team can run without making individual choices
2. Understand what hooks do before they run on the team's machines
3. Know the update/rollback story

**Pain Points:**
1. The 3-plugin choice is a team coordination problem: will everyone on the team make the same choice?
2. No "team install" documentation or "recommended for teams" callout.
3. The hooks are opaque — she does not know what they will block until she reads the source or runs into one.
4. The rollback story is unclear (confirmed from previous research).

**Key Quote (hypothesized):**
> "How do I tell 12 engineers which plugin to install? I needed to make that decision for them, and I wasn't confident I was right."

---

## 3. Journey Map — Primary Persona (Farida)

### Stage 1: Discovery

| Dimension | Detail |
|-----------|--------|
| **Action** | Sees OrchestKit mentioned; clicks GitHub link |
| **Thinking** | "Is this legit? How many people use it?" |
| **Feeling** | Curious, slightly skeptical |
| **Touchpoint** | GitHub README, star count, recent commits |
| **Pain Points** | No immediate social proof cue; star count may be low for new users |
| **Opportunities** | Add "Used by N developers" or testimonial quote above the fold |

**Friction score:** 2/10 (low — standard GitHub discovery)

---

### Stage 2: Consideration (README Reading)

| Dimension | Detail |
|-----------|--------|
| **Action** | Reads README top-to-bottom; hits "Install Options" section |
| **Thinking** | "67 skills vs 45 skills — what am I missing? Do I need Python specializations or are those included in the generic ones?" |
| **Feeling** | Confused, slightly annoyed |
| **Touchpoint** | README Install Options section |
| **Pain Points** | CRITICAL: The 3-plugin choice requires knowledge the user does not yet have. The difference between `orkl` and `ork` is explained at the component level (skills/agents/hooks) not at the outcome level (what you can DO). `ork-creative` is unexplained until the user reads further — most users will wonder if they need it. |
| **Opportunities** | Replace the choice with a single recommended command. Add a one-line decision guide: "Python or React? Use `ork`. Everything else? Use `orkl`." |

**Friction score: 8/10 — this is the primary drop-off point.**

The critical insight: **all three plugins include identical agents (38) and identical hooks (77). The only difference is which skill documents are loaded.** The README does not communicate this. Users assume they are choosing between meaningfully different tool sets, when they are actually choosing between knowledge bundles that add near-zero runtime overhead.

---

### Stage 3: Installation

| Dimension | Detail |
|-----------|--------|
| **Action** | Runs `/plugin marketplace add yonatangross/orchestkit` then `/plugin install ork` |
| **Thinking** | "Did that work? Nothing happened." |
| **Feeling** | Uncertain |
| **Touchpoint** | Claude Code terminal |
| **Pain Points** | Two-step install (marketplace add + install) is not the norm. Most Claude Code plugins are one command. The README Quick Start shows both commands but does not explain why both are needed. |
| **Opportunities** | Explore if a one-command install path is feasible. At minimum, add a post-install confirmation message. |

**Friction score: 5/10**

---

### Stage 4: Health Check (`/ork:doctor`)

| Dimension | Detail |
|-----------|--------|
| **Action** | Runs `/ork:doctor` as instructed |
| **Thinking** | "Everything is green. Now what?" |
| **Feeling** | Neutral — not excited, not worried |
| **Touchpoint** | `/ork:doctor` output |
| **Pain Points** | Doctor confirms the installation works but gives no "here is what to try first" prompt. The user is left in a blank state. There is no contextual next-step that is personalized to their project type. |
| **Opportunities** | Append a "Next Steps" section to the doctor output: "Try `/ork:implement` on your next feature" or "Run `/ork:commit` on your next commit". Make it project-aware if possible. |

**Friction score: 6/10** — health check passes but leaves the user stranded.

---

### Stage 5: First Real Command

| Dimension | Detail |
|-----------|--------|
| **Action** | User tries `/ork:implement` or `/ork:commit` on a real task |
| **Thinking** | "Whoa — it actually did that right." or "This is just a wrapper around what Claude already does." |
| **Feeling** | Delight (if working) or disappointment (if the command feels shallow) |
| **Touchpoint** | Slash command output, hook output in terminal |
| **Pain Points** | `/ork:implement` has a 10-phase workflow and asks for worktree isolation before the user knows what that means. The AskUserQuestion dialogs can feel overwhelming on first use. |
| **Opportunities** | Add a "first-time" detection path in `implement` that uses a simplified 3-phase flow. Log a tip: "You just ran OrchestKit for the first time. Here is what happened..." |

**Friction score: 4/10** — the command itself works well; the friction is cognitive, not technical.

---

### Stage 6: Aha Moment

**The moment:** A hook fires silently — or Claude applies the right pattern without being asked.

For Farida: Her `git commit` is intercepted by the pre-commit hook checking for secrets or branch protection. She did not configure this. It just worked.

**Current time-to-aha: 8–25 minutes.**
- Fast path (Ben-type, CLI-first): install → doctor → first commit → hook fires. ~8 minutes.
- Slow path (Carlos-type, evaluator): README confusion → plugin choice anxiety → delayed install. May never happen.

**Target time-to-aha: under 3 minutes.**

---

## 4. Friction Point Registry

| ID | Friction Point | Stage | Severity | Type |
|----|---------------|-------|----------|------|
| F-01 | 3-plugin choice with insufficient decision context | Consideration | HIGH | Cognitive load |
| F-02 | `orkl` vs `ork` difference not explained at outcome level | Consideration | HIGH | Information architecture |
| F-03 | Skills/agents/hooks terminology unexplained before being used | Discovery | MEDIUM | Jargon barrier |
| F-04 | Two-step install process without explanation of why | Installation | MEDIUM | Process friction |
| F-05 | No post-install "what to do next" guidance from doctor | Health Check | HIGH | Drop-off |
| F-06 | No "try before install" path for evaluators | Discovery | HIGH | Conversion blocker |
| F-07 | `ork-creative` listed alongside core plugins creates confusion | Consideration | MEDIUM | Information architecture |
| F-08 | Hooks are invisible — users do not know what ran or why | First Use | MEDIUM | Transparency |
| F-09 | `/ork:implement` asks complex questions (worktree) before user has context | First Use | MEDIUM | Cognitive load |
| F-10 | No team install documentation for Team Lead persona | Consideration | MEDIUM | Missing content |
| F-11 | README numbers ("67 skills · 37 agents · 81 hooks") convey volume not value | Discovery | LOW | Messaging |

---

## 5. The Plugin Choice Question — Is It Helping or Hurting?

**Verdict: It is hurting.**

The core product insight that the research surfaces: **the only meaningful difference between `orkl` and `ork` is which Markdown skill documents are included.** Agents (38) and hooks (77) are identical across both. Skills are loaded on-demand — they add near-zero runtime overhead when unused.

This means the user is being asked to make a permanent-feeling architectural decision (`orkl` vs `ork`) over what is effectively a documentation filter. That is backwards.

The real question to ask the user is not "which plugin?" but "what stack are you working with?" — and OrchestKit should answer that question for them by defaulting to `ork` (full) in all cases, with `orkl` positioned as a bandwidth-constrained or minimal installation variant, not as the primary recommendation.

**Recommended framing change:**

```
# Before (current)
# Universal toolkit (works for any stack)
/plugin install orkl

# Full toolkit (adds Python, React, LLM/RAG specializations)
/plugin install ork

# After (proposed)
# Recommended install — full toolkit with all specializations
/plugin install ork

# Minimal install — if you need a smaller footprint
/plugin install orkl
```

---

## 6. The "Zero-Friction" Onboarding Vision

### Principle: Default to the right answer, confirm instead of choosing

**Proposed new Quick Start:**

```
Step 1: /plugin marketplace add yonatangross/orchestkit && /plugin install ork
Step 2: /ork:doctor
Step 3: Try /ork:commit on your next commit
```

After doctor, output ends with:
```
Next: try /ork:commit on your next git commit.
      Or run /ork:implement to build a feature with parallel agents.
      Full command list: https://orchestkit.vercel.app/docs/quick-start
```

### Try Before Install

Carlos (the evaluator) represents a real and large segment of developer tool adoption. He will not install without seeing the thing work. The gap:

- No demo GIF or video in the README
- No "playground" on the docs site
- No annotated example of a hook firing or a skill applying

**Minimum viable "try before install":** A 90-second terminal recording (VHS or asciinema) embedded in the README showing: (1) a commit being blocked by a hook, (2) `/ork:implement` spinning up agents, (3) the final output. This alone would significantly improve conversion for the evaluator persona.

---

## 7. User Stories (Prioritized)

### US-001 — Guided next step after doctor

**As a** developer who just installed OrchestKit and ran `/ork:doctor`,
**I want to** see a personalized "what to try first" suggestion,
**So that** I do not have to figure out what to do next from scratch.

**Acceptance Criteria:**
- Doctor output always ends with a "Next Steps" block
- Suggestions are specific: list 2–3 commands appropriate for a first-time user
- If project type can be detected (Python, React, etc.), the suggestion matches the stack

**Priority:** HIGH
**Persona:** All (Farida, Ben, Carlos)
**Effort:** LOW

---

### US-002 — Single default install recommendation

**As a** developer evaluating OrchestKit from the README,
**I want to** know which plugin to install without having to understand the internal architecture,
**So that** I can install confidently in under 30 seconds.

**Acceptance Criteria:**
- Quick Start leads with one command: `/plugin install ork`
- "Install Options" section is demoted to a secondary position or FAQ
- The difference between `orkl` and `ork` is explained in one sentence at the outcome level, not the component level
- `ork-creative` is visually separated as an add-on, not a peer option

**Priority:** HIGH
**Persona:** Farida, Carlos
**Effort:** LOW (README-only change)

---

### US-003 — Demo or animated preview for evaluators

**As a** developer who has not yet installed OrchestKit,
**I want to** see what it looks like in action before committing to install,
**So that** I can evaluate whether it fits my workflow.

**Acceptance Criteria:**
- README contains a terminal recording or GIF showing at least one hook and one skill command in action
- Recording is under 90 seconds
- The recording shows the aha moment (a hook blocking something, or a skill applying a pattern correctly)

**Priority:** HIGH
**Persona:** Carlos
**Effort:** MEDIUM (requires recording tooling — `demo-producer` agent is available)

---

### US-004 — Hook transparency layer

**As a** developer whose commit was modified or blocked by an OrchestKit hook,
**I want to** understand which hook ran and why,
**So that** I trust the automation instead of being confused by it.

**Acceptance Criteria:**
- When a hook fires and takes visible action, it logs a one-line explanation: "OrchestKit (pre-commit-security-scan): blocked commit — API key detected in file.env"
- The log includes the hook name and the reason
- This behavior is on by default

**Priority:** MEDIUM
**Persona:** Ben, Tina
**Effort:** MEDIUM

---

### US-005 — Team install guide

**As a** team lead standardizing Claude Code across my engineering team,
**I want to** know the single command to share with my team,
**So that** everyone installs consistently without making individual plugin decisions.

**Acceptance Criteria:**
- Docs site has a "Team Setup" page or section with a single recommended command
- Page explains what each hook does and whether it can be disabled per-user
- Page addresses the "what if someone is on orkl and someone is on ork" scenario

**Priority:** MEDIUM
**Persona:** Tina
**Effort:** LOW (docs-only)

---

## 8. Success Metrics

| Metric | Current (Estimated) | Target | Measurement Method |
|--------|---------------------|--------|--------------------|
| Time from README open to first command run | ~10 minutes | < 3 minutes | Session recording / funnel analytics |
| Plugin choice confusion (abandonment at install section) | Unknown | < 5% drop-off | README analytics (if available) |
| % of installs that reach first real command beyond doctor | ~40% (estimated) | > 75% | Event tracking on doctor next-step link |
| Day-7 retention (user still running ork: commands after 7 days) | Unknown | > 60% | Plugin usage telemetry |
| Evaluator conversion (GitHub visit → install) | Unknown | > 25% | GitHub referrer + install events |

---

## 9. Recommendations (Impact/Effort Matrix)

| Finding | Recommendation | Impact | Effort | Priority |
|---------|---------------|--------|--------|----------|
| F-01/F-02: Plugin choice causes drop-off | Make `ork` the single Quick Start recommendation; demote `orkl` to secondary option | HIGH | LOW | DO FIRST |
| F-05: No next step after doctor | Add "Next Steps" block to `/ork:doctor` output | HIGH | LOW | DO FIRST |
| F-06: No try-before-install path | Record 90s terminal demo using `demo-producer`; embed in README | HIGH | MEDIUM | DO NEXT |
| F-08: Hooks are invisible | Add one-line hook attribution log when a hook takes action | MEDIUM | MEDIUM | DO NEXT |
| F-03: Jargon barrier (skills/agents/hooks) | Add a 3-sentence "How it works" section to README before the component table | MEDIUM | LOW | DO NEXT |
| F-09: `/ork:implement` first-run complexity | Add first-time detection; simplify initial dialog to 2 questions max | MEDIUM | MEDIUM | PLAN |
| F-10: No team install docs | Add "Team Setup" section to docs site | MEDIUM | LOW | PLAN |
| F-07: `ork-creative` confusion | Visually separate creative tier as add-on with its own callout box | LOW | LOW | MAYBE |
| F-11: README numbers without meaning | Replace "67 skills · 37 agents · 81 hooks" with outcome statements in the hero | LOW | LOW | MAYBE |

---

## 10. The Aha Moment — Design Recommendation

The aha moment is **not** running `/ork:doctor`. It is **not** seeing a health check pass.

The aha moment is: **Claude did the right thing without being told.**

To accelerate this:

1. Make the first hook interaction visible and attributed (see US-004). The user needs to KNOW OrchestKit was responsible.

2. `/ork:commit` is the highest-density aha moment: it runs tests, formats the commit message, and blocks bad pushes — all things developers care about deeply. The README should position this as "try this first", not `/ork:doctor`.

3. For evaluators, the aha moment must happen in the README itself via a demo recording — before they ever install anything.

**Proposed new hero sequence for README:**

```
[30-second GIF: developer runs /ork:commit →
  hook catches missing test coverage →
  Claude suggests a fix →
  commit succeeds with conventional message]

That just happened automatically.
No configuration. No prompting.

/plugin marketplace add yonatangross/orchestkit
/plugin install ork
/ork:doctor
```

---

*Research by: ux-researcher agent*
*Methodology: Behavioral persona analysis, JTBD framework, journey mapping*
*Next handoff: rapid-ui-designer (README redesign), demo-producer (terminal recording)*
