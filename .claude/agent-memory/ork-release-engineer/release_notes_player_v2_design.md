---
name: release-notes-player-v2-design
description: Release-notes player next iteration—categorized lanes, auto-generation from CHANGELOG, adoption tracking, vanilla JS search/filter
metadata:
  type: project
  date: 2026-06-18
  status: DESIGN_APPROVED
---

# Release-Notes Player v2: Design Specification

## Problem Statement

Current player (#2516) is static: RELEASE.items hardcoded, no multi-category view, no auto-generation, no adoption tracking, no search. Scaling to 20+ items requires UI collapse or handcrafting.

## Solution

Single-file HTML player with:
1. **Category lanes** (FEATURES | FIXES | BREAKING | ADOPTION) stacked vertically, color-coded by feature area
2. **Auto-generation from CHANGELOG** via `scripts/generate-release-notes.ts`
3. **Adoption tracking** — requiredCC field links to CC version matrix
4. **Vanilla JS search + filter** — no deps, keyboard-accessible
5. **Severity badges** — P0/critical items visually distinct

## Key Design Decisions

### UI: Lanes Instead of Linear Stream

**Why:** 20+ items stream too fast; users want to focus on what matters (hooks? fable? breaking changes?). Lanes provide visual grouping at a glance.

**How:** Category-grouped stacks with colored left borders (HSL category tokens). Filter buttons hide non-matching lanes. Search query highlights across all lanes.

**Example:**
```
🟦 FEATURES (indigo, fable5/projects-v2)     3 items
├─ Observation graphs in Fable 5
├─ Session resume with --from-pr
└─ Sub-issues (native)

🟩 FIXES (neutral)                           5 items
├─ cc-triage parse_failed on empty-array
└─ [4 more]

🔴 BREAKING CHANGES (red)                    1 item
└─ ⚠ Fable 5 audio token cost (adopt-required)
```

### Data Model: RELEASE.items[] Extensions

**Current shape (working):**
```javascript
{
  tag: "feat",
  tagLabel: "Feature",
  title: "Headline",
  what: "One sentence",
  impact: { kind: "What changes", lines: ["benefit 1", "benefit 2"] }
}
```

**v2 extensions (add, don't break):**
```javascript
{
  // ... above fields ...
  
  // New: category + severity + adoption
  id: "observation-graphs",           // slug for deep-link
  category: "fable5",                 // feature area: fable5|hooks|projects-v2|memory|other
  severity: "medium",                 // critical|high|medium|low
  adoption: {
    status: "auto",                   // auto|required|pending|manual|n/a
    requiredCC: "2.1.175",            // version gate, or undefined
    adoptedIn: "2.1.179",             // ork version shipping this
    notes: "Fable 5 access suspended 2026-06-12"
  },
  
  // New: metadata for generator & linking
  prNumber: 2347,
  commitSha: "a16c4a53",
  dateReleased: "2026-06-18",
  source: "CHANGELOG.md"
}
```

### Auto-Generation: CHANGELOG → Generator → HTML

**Workflow:**
1. Release-please merges to main, creates tag (CC release happens)
2. OrchestKit release-sync skill triggered OR manual: `npx tsx scripts/generate-release-notes.ts 2.1.180`
3. Script parses CHANGELOG.md for `## [2.1.180]` section
4. Extracts bullets, infers category/severity via keyword heuristics
5. Generates RELEASE.items[] JSON
6. Embeds into release-notes-player.template.html
7. Outputs `docs/cc-2.1.180-release-notes.html`

**Generator heuristics:**
```
tag ∈ {feat, fix, perf, breaking, deprecation} — from CHANGELOG section header
category — keyword match: fable|observation→fable5, hook|dispatch→hooks, breaking|P0→critical
severity — keyword match: critical/high/medium/low from text pattern or default "low"
id — slugify(title)
adoption.status — pattern match: "breaking" → "required", "experimental" → "pending", else "auto"
adoption.requiredCC — parse "requires CC 2.1.175" or undefined
impact.lines — split bullet on semicolons, take first 2 segments
```

### Lane Colors (HSL Category Tokens)

| Category | Color | Use Case |
|----------|-------|----------|
| fable5 | hsl(248 84% 68%) | indigo (Fable 5 features, adoption-critical) |
| hooks | hsl(174 66% 52%) | teal (foundational event architecture) |
| projects-v2 | hsl(38 95% 60%) | warm (new capability) |
| breaking | hsl(0 84% 60%) | red (breaking changes) |
| default | hsl(220 18% 93%) | ink (neutral) |

### Search + Filter (Vanilla JS)

**Filter buttons:** All | Features | Fixes | Perf | Breaking — toggle RELEASE.items visibility

**Search box:** Real-time regex filter on title + what + impact.lines; highlights matches; jumps to first match on Enter

**Keyboard:** ↑/↓ navigate lanes, Enter play, Escape cancel search

## Compliance with §10 Self-Audit

- [x] Routing (§0): still a user-story player; lanes don't change archetype
- [x] Persona (§1): cool-glass; no warm/cool mix
- [x] Tokens (§2): HSL with roles; spacing on 4/8/12/16/24 grid; 4 motion durations
- [x] Hierarchy (§3): device feed primary, transport secondary, copy-prompt tertiary
- [x] Glass (§5): blur(16px), border 0.18 alpha, no glow halos
- [x] Motion (§6): 4 durations, 1 signature moment, reduced-motion gate
- [x] Components (§7): device frame unchanged, flow arrow unchanged, copy-prompt unchanged
- [x] RTL (§8): logical properties; arrow flips with scaleX(-1); filter/search locale-agnostic
- [x] Single file, zero deps
- [x] Anti-"generic AI" (§9): no pure black, no hex, no glow, no generic animations

## Deliverables

**Phase 1 (MVP, ~400 lines HTML):**
- release-notes-player.template.html (extended with lanes + search + filter CSS/JS)
- scripts/generate-release-notes.ts (140 lines, post-release hook)
- Exemplar: docs/cc-2.1.179-release-notes.html (already shipping #2516)

**Phase 2 (future):**
- Timeline scrubber (2.1.171→2.1.179) for multi-version comparison
- Before/after micro-demos in impact cards
- GitHub Action post-release-please to auto-invoke generator

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Keyword heuristics mis-classify edge-case bullets | Whitelist false positives, fallback to 'other' if <0.7 confidence, optional manual override field |
| CHANGELOG format drift breaks parser | Vendor a copy, add version check, test on upstream changes |
| Generator requires manual invocation | Add GitHub Action post-release-please to auto-run |
| Severity inference on keywords alone misses nuance | Optional manual override in RELEASE.items |

## Next Steps

1. Extend template.html with lane + search/filter UI (no HTML changes, CSS+JS only)
2. Write scripts/generate-release-notes.ts + unit tests
3. Run on CC 2.1.179 snapshot (docs/feat--playground-release-notes/) verify output
4. Ship as v8.49.0 feature (next regular release)
5. Create GitHub Action for auto-generation post-release-please (2026-07 release)

## See Also

- [[playground-visual-standard]] — §1-10 compliance checklist
- [[release-sync]] — skill that invokes generator as part of release workflow
- [[memory]] — tracks adoption.status + requiredCC across sessions
