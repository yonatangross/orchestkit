# OrchestKit Collaboration Brainstorm: 22 Ideas for the Next Generation

## A Deep Dive for Google NotebookLM Audio Overview

*This document covers the full OrchestKit collaboration brainstorm: 22 ideas across 7 clusters, 3 major design proposals, and the architectural discoveries that make many of them much closer to reality than they first appear.*

---

## What Is OrchestKit and Why Does Collaboration Matter?

OrchestKit is a Claude Code plugin — think of it as a professional toolkit that sits inside your AI coding assistant. It ships with 69 skills (specialized knowledge modules), 38 agents (AI sub-processes that can run in parallel), and 55 hooks (event-driven listeners that watch what you do and react intelligently).

The pitch is compelling: instead of a generic AI assistant, you get one that knows API design patterns, database engineering, security best practices, release management, and dozens of other domains out of the box.

But here's the tension worth exploring: **OrchestKit is excellent at general patterns and blind to your specific world.**

---

## The Three Collaboration Gaps

Before diving into solutions, it's worth understanding exactly what's broken. There are three distinct problems, and they compound each other.

**Gap One: Generic vs. Specific Knowledge**

The 38 ork agents know general patterns — API design principles, database engineering fundamentals, security best practices. What they don't know is *your* stack. Your team might use UUIDv7 for primary keys instead of auto-increment. You might run pgvector for semantic search. Your infrastructure might use Caddy as a reverse proxy, Celery for background jobs.

Every single session, you're re-explaining this context. The agents forget. The sessions are stateless.

*A good question for the hosts to explore: Why can't the agents just remember? What's the architectural reason this is hard?*

**Gap Two: Agents Don't Share State**

When OrchestKit's brainstorming skill spawns four parallel agents to explore a problem from different angles — frontend, backend, security, architecture — each agent produces a blob of prose output. The lead agent then reads all four blobs and tries to synthesize them mentally. This is lossy. Information gets dropped. Nuances disappear.

There's no structured data passing between agents. No shared workspace. No way for the backend agent to say "here's the API contract, frontend agent, build against this exact spec."

**Gap Three: Hooks Collect But Don't Feed Back**

This is the sneaky one. The 55 hooks are impressive: they track tool usage patterns, catch errors, log skill invocations, monitor agent output quality, record session timings. All of this intelligence gets written to log files.

And then... nothing. The intelligence is never fed back to improve agent behavior. It's like having a world-class analytics team that produces beautiful reports that no one reads.

---

## Design A: The Bridge Layer — Connecting Your World to OrchestKit

*Theme: Making OrchestKit aware of what you already have.*

### The Setup Wizard Problem

OrchestKit ships with a `/ork:setup` wizard that scans your tech stack — it can detect Python projects, React frontends, TypeScript codebases. That's useful. But it's completely blind to your existing Claude Code infrastructure.

It doesn't see:
- Custom agents you've built in `.claude/agents/`
- Project-specific skills in `~/.claude/skills/`
- Your coding rules in `.claude/rules/`
- Your memory graph (what Claude already knows about your project)
- MCP servers you've already configured

This means setup treats every project as a blank slate, even when there's a rich existing ecosystem to build on.

### Idea 1: Stack Profile Files

**The core concept:** A single JSON file at `.claude/stack-profile.json` that captures your team's conventions. UUID strategy, preferred libraries, server topology, architectural decisions. Every ork agent reads this at boot.

Think of it like an onboarding document for new team members — except it's for AI agents instead of humans. A new hire doesn't make you explain your database strategy every morning. The stack profile file means the agents don't either.

**The implementation insight:** OrchestKit already has a `UserPromptSubmit` hook that fires at the start of every conversation. The stack profile content can be injected through `systemMessage` rather than `additionalContext`. And here's why that matters enormously — we'll come back to this.

**Feasibility: 9 out of 10.** This is close to a convention-level change. The hook already exists, the injection point already exists.

### Idea 2: Setup CC Infrastructure Scan

**The core concept:** When you run `/ork:setup`, it doesn't just detect your tech stack — it also maps your existing Claude Code infrastructure and shows you compatibility.

Imagine running setup and getting output like: "Your `api-standards.md` rules file overlaps significantly with the `ork:api-design` skill. Here's how they complement each other and where they might conflict."

*A question worth exploring: Does this make OrchestKit more useful, or does it risk creating confusing duplication?*

This is essentially turning setup from a one-way configuration tool into a two-way integration audit.

**Feasibility: 9 out of 10.** Technically this is a new Glob batch scan added to the setup skill. The challenge is in the UX — what's the right way to surface compatibility information without overwhelming the user?

### Idea 3: Context Packs

**The core concept:** Composable knowledge bundles, 100 to 300 tokens each, stored in `.claude/context-packs/`. An agent can declare which context packs it needs: `context-packs: [pgvector, celery-queues, uuidv7-strategy]` and those get injected at spawn time.

Think of context packs like LEGO blocks of domain knowledge. The pgvector context pack contains the key patterns, gotchas, and conventions for using pgvector in your stack. The Celery queues pack has your job naming conventions, retry strategies, and queue topology. Each pack is small and composable. Agents declare what they need.

*A natural question: Who maintains these packs? The user? OrchestKit? Both?*

The answer is both — OrchestKit ships base packs for common tools, and teams extend with project-specific packs.

**Feasibility: 8 out of 10.** The `SubagentStart` hook already has a context-stager that can inject into `systemMessage`. The main work is defining the pack format and the declaration syntax.

### Idea 4: Living Agent Brief

**The core concept:** A `PostToolUse` hook that watches for meaningful project changes — schema migrations, new Docker services added to compose files, new environment variables — and automatically appends them to `.claude/project-brief.md`.

The project brief becomes self-maintaining documentation. Instead of remembering to update your onboarding docs when you add a new service, the hook catches it and records it. Over time, the brief becomes a living record of how the project has evolved.

**Feasibility: 8 out of 10.** `PostToolUse` already fires. The pattern detection (looking for Docker compose changes, migration files, env var additions) is heuristic-based and achievable without LLM calls.

---

## The 800-Token Discovery — The Key Architectural Insight

Before moving to Design B, there's a critical architectural finding that affects almost everything else.

Throughout OrchestKit's hook system, two dispatchers — `UserPromptSubmit` and `SubagentStart` — enforce a hard limit: `MAX_OUTPUT_TOKENS = 800` for `additionalContext`. This budget is shared across all hooks that want to inject context. Stack profiles, context packs, skill guidance, agent instructions — they're all competing for 800 tokens.

**But there's a back door.**

The `SubagentStart` context-stager already injects via `systemMessage` rather than `additionalContext`. And `systemMessage` has no token cap.

This is the key architectural insight for the entire Bridge Layer design. Stack profiles and context packs injected through `systemMessage` bypass the budget entirely. Instead of cramming everything into 800 tokens, you can provide rich, detailed context — exactly what you need when giving an agent your team's full database strategy.

*An interesting question for the hosts: Does this feel like a loophole, or is it the intended design? Why would the system have these two separate injection paths with different limits?*

The answer is probably that `additionalContext` is meant for hook-generated suggestions and nudges — short, dynamic content. `systemMessage` is meant for stable, structural context. The distinction makes sense architecturally; OrchestKit just hasn't been fully exploiting it.

---

## Design B: Structured Agent Handoffs — Agents Sharing State During Team Sessions

*Theme: Making agents collaborators instead of parallel solo workers.*

### The Ghost Infrastructure Problem

Here's something genuinely surprising about the current codebase. OrchestKit already has two hooks dedicated to agent collaboration:

- `handoff-preparer`: Prepares handoff data when one agent finishes
- `feedback-loop`: Processes feedback between agents

And it has a designated directory for handoff files: `.claude/context/handoffs/`

So the infrastructure for agent handoffs exists. Handoff files get written. And then... zero hooks read them. The files are written and abandoned. It's ghost infrastructure — present in the codebase, invisible in practice.

*This is worth sitting with for a moment. Why would this happen? The answer is probably timing: the hooks were built before the consumers existed, or the consumers were planned but never shipped.*

### The Critical Bug

There's something even more surprising. Look at `feedback-loop.ts`, line 302. The feedback-loop hook — the one that's supposed to coordinate between agents — silences itself when Agent Teams mode is active.

```
if (isAgentTeamsActive()) { return outputSilentSuccess(); }
```

Agent Teams mode is exactly the scenario where handoffs and feedback loops matter most. Multiple agents, parallel execution, structured coordination. And the feedback-loop hook says "not my problem" and exits silently.

This means any handoff implementation needs to route around this. The context-publisher and agent-memory-store hooks don't have this guard. They're the right path forward.

### Idea 5: Agent Handoff Bus

**The core concept:** A convention, not a framework. Each agent writes structured JSON to a scratch directory when it finishes. The orchestrating agent reads all the files and merges deterministically.

This is the simplest possible version of structured agent collaboration. No new infrastructure. No new hook types. Just a convention: when you finish, write a JSON summary of what you produced. When you're the coordinator, read all the summaries.

The key addition is output schema templates — standardized JSON shapes for common artifact types. An API schema has fields. A database design has tables, relations, indexes. Giving agents a template to fill out means the coordinator gets structured data, not just prose.

**Feasibility: 9 out of 10.** This is almost entirely a convention. The engineering is minimal.

### Idea 6: Typed Artifact Blackboard

**The core concept:** A shared workspace at `.claude/blackboard/` where agents write named, typed artifacts. The magic is that downstream agents pull by *type*, not by producer name.

A frontend UI developer agent needs an API schema. It shouldn't need to know that the backend system architect produced it. It just asks: "give me the current `api_schema` artifact." The blackboard holds it. Type-based retrieval decouples producers from consumers.

Think of the blackboard like a whiteboard in a physical office where different people leave deliverables. "Here's the DB schema" goes up on the board. "Here's the API contract" goes next to it. Anyone who walks in and needs the API contract just takes it. They don't need to find the specific person who wrote it.

*A question worth exploring: What happens when two agents produce conflicting artifacts of the same type? Who wins?*

This is a real challenge. The answer probably involves versioning and explicit resolution strategies — the orchestrator decides which version is authoritative.

**Current blocker:** The `context-publisher` hook currently truncates artifact content to 200 characters. This needs to be lifted for the blackboard to work. **Feasibility: 8 out of 10** with that fix.

### Idea 7: Agent Capability Manifests

**The core concept:** Agent `.md` files declare what they `provides:` and what they `requires:`. A contract broker hook matches available artifacts to agent needs before spawning.

```yaml
provides:
  - type: api_schema
    format: openapi-3.0
requires:
  - type: database_schema
    format: sql-ddl
```

Before the backend architect agent runs, the hook checks: is a `database_schema` available? If yes, inject it. If no, maybe the database engineer needs to run first.

This is the most ambitious idea in Design B. It's moving toward formal dependency management for agent workflows.

**Key finding from the codebase:** Agent `.md` files are never read by hooks at spawn time. There's currently no mechanism to parse an agent's frontmatter before it starts. Implementing this requires adding a file-read step to the `SubagentStart` hook — not impossible, but non-trivial.

**Feasibility: 7 out of 10.** Higher engineering investment than the other ideas.

### Idea 8: Session Knowledge Graph

**The core concept:** The `SubagentStop` hook extracts structured facts from agent output into a session-scoped graph. When agent B starts, it gets injected with relevant facts from agent A's graph entries.

*Here's the elegant part:* Two hooks already exist that do 80% of this.

- `agent-memory-store` already writes JSONL files with agent findings
- `graph-memory-inject` already reads from that JSONL and injects relevant context

The gap is that right now, `graph-memory-inject` suggests MCP tool calls to write to the graph — it doesn't write directly. Closing the loop means switching to direct JSONL writes.

**Feasibility: 8 out of 10.** The infrastructure exists. This is about closing a loop that's 80% closed already.

---

## Design C: Skill Pipelines and Hook Intelligence

*Theme: Making OrchestKit learn from what it observes.*

### The Biggest Surprise: Pipelines Are 80% Built

If you were to design skill pipelines from scratch — the ability to chain skills and agents in predefined workflows — you'd expect significant engineering work. Create a pipeline DSL. Build an execution engine. Handle state persistence.

OrchestKit already has all of this:

- `pipeline-detector.ts` detects trigger phrases and constructs pipeline executions
- `multi-agent-coordinator.ts` has five predefined pipelines: `product-thinking`, `full-stack-feature`, and three others
- `task-completer.ts` chains agents via `TaskCompleted` events
- The `checkpoint-resume` skill handles state persistence across session interruptions

The only gap: the pipelines are hardcoded in TypeScript. To add a new pipeline or customize an existing one, you edit source code and rebuild. A YAML loader would make pipelines user-configurable without touching code.

*A good question: What's the cost of the YAML approach vs. the TypeScript approach? What do you lose when you move from code to config?*

You lose type safety and the full expressiveness of a programming language. You gain accessibility — a team lead who doesn't write TypeScript can now define a pipeline for their team's `product-thinking` workflow.

### Idea 9: Model Velocity Calibrator

**The core concept:** Track which task types succeed with Haiku (the fast, cheap model) vs. Sonnet (the capable, expensive model) vs. Opus (the most capable, most expensive). Automatically route similar future tasks to the appropriate tier.

The data is already flowing. `TaskCompleted` events since Claude Code version 2.1.30 include `token_count` and `tool_uses` for every completed task. A calibration engine already exists in the codebase and tracks success rates per agent type.

The new piece is the correlation: task type + complexity + outcome → model tier recommendation. Over time, the system learns that "generate a unit test for a simple function" succeeds with Haiku 94% of the time, so route those there. "Architect a distributed caching strategy" needs Sonnet or Opus.

*An interesting question: Is this actually cost optimization, or is it quality optimization? The answer is both — the right model for the task produces better output faster.*

**Feasibility: 8 out of 10.** The event data exists. The calibration engine exists. The routing advisory mechanism exists. This is primarily about adding the correlation tracking layer.

### Idea 10: Error Pattern Router

**The core concept:** When an agent type repeatedly fails on a specific task type, inject a routing advisory — either route to a more capable model, or inject specific guidance about the failure pattern.

Here's the elegance: `task-completer.ts` already has the `error` field populated on failures. The calibration engine already supports a 'failure' outcome type. The gap is literally two lines of code to wire them together.

When the system has seen "data-pipeline-engineer agent fails on schema migration tasks 60% of the time," it can either upgrade the model tier for those tasks or pre-inject known mitigation strategies.

**Feasibility: 8 out of 10.** This is genuinely two lines — the infrastructure is complete.

### Idea 11: Skill Chain Anticipator

**The core concept:** Build a co-occurrence matrix from skill usage sequences. If `api-design` is followed by `database-patterns` 78% of the time, pre-load the database-patterns Quick Reference when api-design starts.

The data source: `skill-tracker` already logs to `skill-analytics.jsonl` with perfect sequence data — timestamp, skill name, context. The co-occurrence matrix is straightforward to compute from this log.

Think of it like a music streaming service's "people who listened to X also listened to Y" — except for AI skills instead of songs. The anticipation means the next skill loads faster and with pre-staged context.

*A question worth asking: Could this create false dependencies? What if your workflow is unusual?*

The system should probably require a threshold (maybe 10 observations and 70% co-occurrence) before pre-loading, and pre-loading should be a soft hint, not a hard trigger.

**Feasibility: 7 out of 10.** The data exists. The math is straightforward. The trickier part is the pre-loading mechanism — how does a hint in one skill trigger context preparation for another?

### Idea 12: Quality Regression Detector

**The core concept:** Maintain a rolling baseline of quality scores per agent type. When output quality drops below 1.5 standard deviations from baseline, inject a "be thorough" advisory.

The `subagent-quality-gate` hook already has an `extractScores()` function that finds "Score: 7.5/10" patterns in agent output. The new piece is the rolling baseline — a 50-observation window per agent type that tracks the historical distribution.

When the `backend-system-architect` agent's recent output scores 5.8 while its baseline is 7.4, something has changed. Maybe the task is unusually complex. Maybe there's context missing. The advisory injection gives the agent a nudge: "previous outputs on tasks like this averaged 7.4. Be thorough."

**Feasibility: 8 out of 10.** The score extraction exists. The baseline computation is roughly 80 lines of code.

---

## Tier 3 Ideas: Longer Horizons (v8 and Beyond)

These ideas are worth understanding even though they're not close to implementation. They represent the architectural directions OrchestKit could grow toward.

### Progressive Skill Loading

**The concept:** Haiku gets 800 tokens of skill instructions. Opus gets 12,000 tokens from the same skill, based on a `skill-appetite` declaration in the agent's frontmatter.

The appeal is obvious — why give a cheap, fast model the same rich context as the most capable model when it can't use it? Tailor the depth to the capability.

**The challenge:** SKILL.md files don't have section markers today. You'd need to add structured sections ("Quick Reference," "Detailed Guidance," "Edge Cases") that the loading system could truncate to.

### Shared Org Memory Graph

**The concept:** A team-wide MCP memory server where patterns accumulate across all projects and all developers. When the team learns that UUIDv7 works better than UUID4 for their use case, that knowledge persists in the shared graph.

**The challenge:** This is an operational challenge more than an engineering challenge. Who hosts the server? How is access controlled? What happens when developers have conflicting experiences? The auth model for "install shared memory from the internet" is genuinely hard.

### Agent Layering and Inheritance

**The concept:** Agents support an `extends:` key for a plugin → org → project override chain. Your project's `backend-engineer` extends the org's `backend-engineer`, which extends OrchestKit's base `backend-engineer`. You only override what's different.

**The challenge:** Claude Code doesn't natively support this. A hook-based merge system could implement it, but the engineering surface is significant. You'd need to define merge semantics for every frontmatter field.

### Cross-Session Pattern Distillation

**The concept:** At session end, an async hook extracts reusable patterns from what was produced and stores them for future sessions.

**The challenge:** Pattern extraction that's meaningful requires an LLM call, and no hook today makes LLM calls. A heuristic-only path (extracting code snippets, capturing repeated decisions) is feasible but limited. This is probably a v9+ feature when hook capabilities expand.

### Agent Marketplace

**The concept:** Community-contributed agent bundles installable via `/ork:agents install`.

**The challenge:** "Install an agent from the internet" is a security problem that doesn't have an easy solution. What level of access does a community agent get? Who audits them? How do you handle malicious agents? This is genuinely v9+ territory.

---

## The Seven Clusters — How the 22 Ideas Relate

It's useful to see the 22 ideas as seven thematic clusters:

**Cluster 1: Stack Awareness** — Stack Profile Files, Setup CC Infrastructure Scan. Both address Gap One (generic vs. specific knowledge) by making OrchestKit aware of your environment.

**Cluster 2: Context Distribution** — Context Packs, Living Agent Brief. How do you get the right context to the right agent efficiently?

**Cluster 3: Agent Handoffs** — Agent Handoff Bus, Typed Artifact Blackboard. The low-tech and high-tech versions of structured agent-to-agent communication.

**Cluster 4: Agent Contracts** — Agent Capability Manifests, Relay Protocol (implicit in the blackboard design). Formalizing what agents produce and consume.

**Cluster 5: Pipeline Intelligence** — Skill Pipelines YAML Loader, Skill Chain Anticipator. Making the existing pipeline system accessible and predictive.

**Cluster 6: Model Intelligence** — Model Velocity Calibrator, Error Pattern Router. Closing the loop from Hook data to model routing decisions.

**Cluster 7: Quality Intelligence** — Quality Regression Detector, Cross-Session Pattern Distillation. Using historical output quality to improve future outputs.

---

## Implementation Priority: What to Build First

The sequencing insight is important: many of the highest-impact ideas are also the easiest to implement because they're wiring together infrastructure that already exists.

### Phase 1 — Hours Each (Wire What's Already Built)

- **Skill Pipelines YAML Loader** — the pipeline execution engine is 80% done. Adding a YAML config loader is the remaining 20%.
- **Error Pattern Router** — literally two lines to wire `task-completer.ts` error field to the calibration engine's failure outcome.
- **Setup CC Infrastructure Scan** — add a Glob batch scan to the existing setup skill. New capability, minimal new code.
- **Stack Profile Files** — a new once-hook in the prompt dispatcher that reads `.claude/stack-profile.json` and injects via `systemMessage`.
- **Agent Handoff Bus** — define the convention, create output schema templates. Almost entirely documentation and convention.

### Phase 2 — One to Two Days Each (Extend Existing Hooks)

- **Session Knowledge Graph** — switch from MCP advisory to direct JSONL writes in `graph-memory-inject`.
- **Quality Regression Detector** — add the 50-observation rolling baseline to `subagent-quality-gate`.
- **Context Packs** — extend the `SubagentStart` context-stager to load from `.claude/context-packs/`.
- **Model Velocity Calibrator** — add task-type correlation tracking to the existing `TaskCompleted` handler.
- **Skill Chain Anticipator** — compute co-occurrence matrix from existing `skill-analytics.jsonl` data.

### Phase 3 — Days to Weeks (New Architecture)

- **Typed Artifact Blackboard** — structured extraction, type-based retrieval, conflict resolution.
- **Agent Capability Manifests** — add file-read step to `SubagentStart`, parse provides/requires frontmatter.
- **Typed Skill Contracts** — define inputs/outputs specification for skills.

---

## The Architectural Through-Line

Stepping back, all 22 ideas are expressions of the same fundamental insight:

**OrchestKit has built excellent observation infrastructure (55 hooks), excellent execution infrastructure (38 agents, 69 skills), and a significant gap in the middle — the layer that feeds observations back to improve execution.**

The Bridge Layer closes the gap between the user's world and OrchestKit's generic knowledge. Structured Handoffs close the gap between parallel agent execution and coherent multi-agent output. Hook Intelligence closes the gap between what hooks observe and what agents do next.

None of these are exotic ideas. They're about connecting systems that were built independently and haven't been wired together yet. The pipeline system was built; the YAML loader wasn't. The handoff files were built; the readers weren't. The quality scores were built; the baseline tracking wasn't.

*A question worth ending on: Is this a technical debt story or an opportunity story?*

It's an opportunity story. The foundation is genuinely solid. The hooks fire reliably. The agents produce useful output. The skills provide real domain knowledge. What's missing is connective tissue — and connective tissue is much easier to build than foundations.

---

## Key Terms Glossary

For listeners who want a quick reference:

- **Skill** — A knowledge module in OrchestKit. 69 total. Examples: `api-design`, `database-patterns`, `security-patterns`. Invoked via `/ork:skillname`.
- **Agent** — An AI sub-process that can run in parallel with other agents. 38 total. Examples: `backend-system-architect`, `frontend-ui-developer`, `security-auditor`.
- **Hook** — An event-driven listener that fires when something happens (user submits a prompt, agent starts, tool is used, agent finishes). 55 total.
- **Context Pack** — A proposed 100-300 token domain knowledge bundle. Like a focused reference card for a specific technology.
- **Blackboard** — A proposed shared workspace where agents write typed artifacts for other agents to consume.
- **additionalContext** — The injection channel hooks use to add context to conversations. Hard limit: 800 tokens across all hooks.
- **systemMessage** — An alternative injection channel with no token cap. Key insight: the `SubagentStart` stager already uses this path.
- **Handoff Bus** — A proposed convention for structured JSON exchange between agents in a team session.
- **JSONL** — JSON Lines format. Each line is a valid JSON object. Used by `agent-memory-store` and `skill-tracker` for append-only logging.
- **TaskCompleted event** — A Claude Code event that fires when a sub-agent finishes. Since version 2.1.30, includes token count and tool usage data.

---

*End of OrchestKit Collaboration Brainstorm Document*

*Optimized for Google NotebookLM Audio Overview generation. 22 ideas, 7 clusters, 3 design proposals, 1 critical bug, and the 800-token discovery that changes everything.*
