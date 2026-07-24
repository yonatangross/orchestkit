---
name: reference-execution-primitive-tradeoffs
description: Reliability/cost bands for the 5 ork execution primitives + the deterministic strategy-routing decision table (2026)
metadata:
  type: reference
---

Ground truth used by the #2516 Execute selector auto-recommend (see [[project-execute-strategy-selector-2516]]). Decided by a 9-agent ork council.

**5 primitives + 2026 reliability/cost bands:**
| Strategy | Reliability | Cost | Note |
|----------|-------------|------|------|
| Workflow tool (pipeline) | ~90% | 1× | deterministic JS fan-out; agents generic or `ork:*` via agentType; cheap |
| ork skill | ~88% | 1× | `/ork:write-prd`, `/ork:implement`, `/ork:remember` — single capability |
| Nested sub-agents (orchestrator-worker) | ~80% | ~1.4× | `Agent()` with declared sub-agents, ≤3 levels deep |
| Agent Teams (mesh) | 60-70% | ~3× | named `ork:*` peer mesh + SendMessage; every msg = round trip |
| Swarm / council (free-swarm) | 35-55% | Nx | Karpathy LLM-council: parallel + blind peer review + chairman |

Reliability ranking: pipeline ~90% > orchestrator-worker ~80% > mesh 60-70% > free-swarm 35-55%. Mesh ~3× cost.

**Deterministic decision table (defaults, explicit tags win over impact/effort):**
- tags match debate/critique/review/verdict/council → mesh, capped ≤4
- tags match migrat/same-transform/batch/rename/sweep → swarm-migrate
- tags match prd/spec/remember/memory/write → direct ork skill
- else card.effort ≥ 4 (independent subtasks) → pipeline fan-out
- else → single skill call

**Mesh cap rule:** hard ceiling of 4 peers — selecting mesh with >4 is structurally rejected (reliability cliff), not just warned.
