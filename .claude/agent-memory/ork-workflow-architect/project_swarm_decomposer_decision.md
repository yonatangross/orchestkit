---
name: swarm-decomposer-decision
description: First-principles council verdict on the general-purpose swarm auto-decomposer (BUILD-MINIMAL as a topology+specialist router, not a coordinator)
metadata:
  type: project
---

Council question (2026-06): build ONE primitive that takes any goal -> decomposes -> auto-assigns ork:* specialists -> auto-picks topology -> coordinates + verifies? Or keep hand-designed Workflow fan-outs + Agent Teams.

Verdict (first-principles seat): **BUILD-MINIMAL**, but the right primitive is NOT a "decomposer/coordinator." Coordination is already solved (Workflow = deterministic pipeline, Agent Teams = mesh, parallel sub-agents = fan-out). The actual gap is *selection*: given a goal, which topology + which specialists. So the minimal unit is a **stateless topology+roster router that emits a plan artifact** (a Workflow script or a team roster), and then hands off to the EXISTING executors. It does not coordinate or verify itself.

**Why:** Auto-decomposition is the wrong abstraction because decomposition quality is the hard part and a generic LLM decomposer inherits the 35-55% free-swarm reliability ceiling (compounds to ~36% failure over 20 steps). A *router* that defaults to deterministic pipeline / orchestrator-worker and only escalates to peer-mesh on genuine debate tasks avoids that ceiling and the ~3x mesh cost. Selection is a one-shot classification (cheap, verifiable) whereas coordination-as-a-primitive re-implements what Workflow already does deterministically.

**How to apply:** If asked to design this, design a router skill, not a swarm engine. Minimal viable: (1) goal -> topology classifier (default deterministic pipeline; orchestrator-worker for fan-out/synthesis; mesh ONLY for adversarial debate), (2) specialist matcher over the 39 src/agents descriptions, (3) EMIT a Workflow script or team roster as an inspectable artifact (human-in-loop gate, no silent execution), (4) reuse /ork:assess blind-refuter verification — do not invent a new verify loop. Keep it $0/idle and on-demand (matches the no-LLM-in-bg-hooks cost rule). Relates to [[workflow-authoring-gotchas-shared]] (workflow subagents edit primary tree; args arrive as string).
