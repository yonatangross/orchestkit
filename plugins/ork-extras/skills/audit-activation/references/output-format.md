# Output Format

Render the activation audit as ASCII + semantic emojis (per OrchestKit visual style). Three sections.

## 1. Spawn split (headline)

```
📊 AGENT SPAWNS (N total · <window>)
  generic CC    ████████████████████████████████████░░  74%  🔴
  ork catalog   ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  14%  ⚠️
  other-plugin  ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  11%
```

## 2. Catalog table

```
AGENT                       ATTEMPTED  STARTED  COMPLETED  SKILL-REFS  STATUS
web-research-analyst             26       26         24           4    ✅ ACTIVE
monitoring-engineer                2        0          0           1    🔧 MIS-TRIGGERED
ai-safety-auditor                  0        0          0           1    🟦 NICHE
<dead-example>                     0        0          0           0    💀 DEAD
```

Sort: ACTIVE (by fires desc), then MIS-TRIGGERED, NICHE, DEAD.

## 3. Verdict line + concentration

```
  started: 20/37 · observed zero starts: 17 (fix 6 · niche 11 · dead 0) · top-5 = 83% of catalog starts
  ▶ Next: wire MIS-TRIGGERED agents into a high-traffic skill (subagent_type=).
    Do NOT rewrite descriptions (A/B Δ0). Prune only DEAD.
```

## --json mode

When invoked with `--json`, emit schema version 1 with `{ window, catalog, coverage, totals:{attempted,started,completed,unattributed,catalog,...}, agents:[{name,attempted,started,fires,completed,skillRefs}], observed_zero_starts }`. `fires` is a compatibility alias for `started`; `totals.ork` is a compatibility alias for `totals.catalog` under the default namespace; no field represents unique spawns. Useful for chaining into a dashboard.
