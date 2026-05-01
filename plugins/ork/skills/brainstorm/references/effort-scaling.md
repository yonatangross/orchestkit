# Effort-Aware Phase Scaling

CC 2.1.76 introduced `/effort` levels; `xhigh` was added in CC 2.1.111 (Opus 4.7 only). The effort-aware context budgeting hook (global) detects effort level automatically — adapt the phase plan accordingly.

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
