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
AGENT                          FIRES  SKILL-REFS  STATUS
web-research-analyst             26       4        ✅ ACTIVE
monitoring-engineer               0       1        🔧 MIS-TRIGGERED
ai-safety-auditor                 0       1        🟦 NICHE
<dead-example>                    0       0        💀 DEAD
```

Sort: ACTIVE (by fires desc), then MIS-TRIGGERED, NICHE, DEAD.

## 3. Verdict line + concentration

```
  fired: 20/37 · dormant: 17 (fix 6 · niche 11 · dead 0) · top-5 = 83% of spawns
  ▶ Next: wire MIS-TRIGGERED agents into a high-traffic skill (subagent_type=).
    Do NOT rewrite descriptions (A/B Δ0). Prune only DEAD.
```

## --json mode

When invoked with `--json`, emit `{ window, totals:{generic,ork,other}, agents:[{name,fires,skillRefs,status}], dormant:{fix,niche,dead} }` and skip the ASCII. Useful for chaining into a dashboard.
