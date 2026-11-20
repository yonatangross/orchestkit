# Effort-Aware Phase Scaling

CC 2.1.76 introduced `/effort` levels; `xhigh` was added in CC 2.1.111. Each model starts at its own default: Opus 5.5 (the `opus` alias) defaults to `medium`, so set `high` or `xhigh` explicitly for a full brainstorm. The effort-aware context budgeting hook (global) detects effort level automatically; adapt the phase plan accordingly.

| Effort Level | Phases Run                                                                                        | Token Budget | Agents |
|--------------|---------------------------------------------------------------------------------------------------|--------------|--------|
| **low**      | Phase 0 → Phase 2 (quick ideation) → Phase 5 (light synthesis)                                    | ~50K         | 2 max  |
| **medium**   | Phase 0 → Phase 2 → Phase 3 → Phase 5 → Phase 6                                                   | ~150K        | 3 max  |
| **high**     | All 7 phases (default)                                                                            | ~400K        | 3-5    |
| **xhigh**    | All 7 phases + extra devil's-advocate round in Phase 4 + extra synthesis dimension in Phase 5     | ~550K        | 3-5    |

```python
# Effort detection — the global hook injects effort level, but also check:
# If user said "quick brainstorm" or "just ideas" → treat as low effort
# If user selected "Quick ideation" in Step 0a → treat as low effort regardless of /effort
```

> **Override:** Explicit user selection in STEP 0a (e.g., "Open exploration") overrides `/effort` downscaling.

## Phase 2 runs at low at every level

The level above decides which phases run and how many agents. It does not decide the effort of the divergent phase: Phase 2 always runs at `low`, and Phases 3 to 6 run at the session effort.

| Phase | Effort | Why |
|-------|--------|-----|
| 2. Divergent exploration | `low` | Quantity and speed; nothing is judged here |
| 3 to 6. Gate, evaluation, synthesis, presentation | session | Devil's-advocate scoring is where depth pays |

Claude Code gives three effort knobs, and only one is scoped to a phase:

- `effort:` in skill frontmatter covers the whole skill (for this `context: fork` skill, the whole fork). Brainstorm has no such key on purpose: `effort: low` would also run Phase 4 at low.
- The Agent tool takes a per-call `model`, not a per-call `effort`. Agents spawned with it run at their own frontmatter effort.
- A Workflow `agent()` call takes `effort` per call. `workflows/brainstorm-diverge.js` passes `effort: "low"` to every generator, the top-up round included, and returns raw ideas with no scores.

`tests/unit/test-brainstorm-diverge.mjs` fails if any generator call drops `effort: "low"`; `tests/skills/test-skill-effort-ladder.sh` fails if brainstorm gains a skill-level effort key.
