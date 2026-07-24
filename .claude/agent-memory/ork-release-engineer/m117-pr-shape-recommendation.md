---
name: M117 PR Shape Recommendation
description: Two-PR split strategy for CC 2.1.117 adoption milestone (adoption + hygiene)
type: project
---

## Three PR Shape Options for M117

### Option A: Single bundled PR — All 7 issues
- **PR title**: `feat(#117): CC 2.1.117 adoption + Monitor/OTEL/PushNotification + hygiene`
- **Closes**: #1447 #1448 #1450 #1449 #1451 #1452
- **Pros**: Aligns with user preference (established in #1376, #1378, #1380). Single review cycle. Milestone closes in one shot.
- **Cons**: Mixed signal in changelog. Feat + chore + test blended. Commit log harder to bisect if a single issue regresses. Deferred #1453 creates a semantic problem: shipping a no-op (Setup/SubagentStart hooks registered but not wired).
- **Changelog**: Features and hygiene entries mixed. Unclear what the actual user value is.

### Option B: Two PRs — Adoption tier + Hygiene tier (defer #1453)
- **PR 1 (Adoption)**: `feat(#117): CC 2.1.117 adoption — Monitor, OTEL, PushNotification`
  - Closes: #1447 #1448 #1450
- **PR 2 (Hygiene)**: `chore(#117): test + hook registration hygiene`
  - Closes: #1451 #1452 #1449
- **Separate issue**: #1453 stays open (no-op filing, close as wontfix with rationale)

- **Pros**: Clean changelog signal. Adoption release has clear user value. Hygiene PR is internal. Each PR is small (3 issues), easy to bisect. Aligns with semantic-release conventions: feat release separate from chore.
- **Cons**: Two review cycles (sequential, not parallel). Two PRs to land.
- **Changelog**: "Features: Monitor integration, OTEL enrichment, PushNotification support." Then "Chores: test hardening, hook registration cleanup."

### Option C: Three PRs — Adoption + Test infra + Hook registration (defer #1453)
- **PR 1**: `feat(#117): Monitor/OTEL/PushNotification adoption` (#1447, #1448, #1450)
- **PR 2**: `test(#117): property-based hook input validation` (#1452)
- **PR 3**: `feat(hooks,#117): register CwdChanged + FileChanged` (#1449, #1451)

- **Pros**: Hyper-semantic. Each PR has single purpose. Test PR can be merged faster (no adoption risk).
- **Cons**: Three review cycles. Overkill for this milestone. Violates bundled preference (user prefers 3–8 issues per PR, not 1–2).
- **Changelog**: Too granular, harder to read the release story.

## Recommendation: Option B (Split into Adoption + Hygiene)

**Why Option B wins:**
1. Respects user's bundled-PR preference (3–5 issues per PR is within the 3–8 sweet spot).
2. Semantic changelog. Adoption work separately celebrated from hygiene.
3. #1453 (Setup/SubagentStart) stays deferred. Shipping a no-op hook registration is worse than deferring it — users would see "Setup events now registered!" but they'd be non-functional.
4. Two PRs sequence quickly (adoption lands first, hygiene 1–2 days later).
5. Easy to bisect if regression occurs.

## PR 1: Adoption (Adoption Tier)

```
Title: feat(#117): CC 2.1.117 adoption — Monitor, OTEL, PushNotification

Body:
Integrates three headline features from CC 2.1.117:
- Monitor tool active use in ork:implement, ork:cover, ork:verify
- OTEL analytics surface in ork:analytics dashboard
- PushNotification wiring for long-running skill completion

Closes #1447 #1448 #1450
```

## PR 2: Hygiene (Infrastructure Tier)

```
Title: chore(#117): test hardening + hook env mgmt hygiene

Body:
Test infrastructure + hook registration follow-ups:
- Property-based test suite for hook input validation
- CwdChanged/FileChanged hook registration for reactive env management
- Release cadence decision (feat-trigger with 14-day grace period)

Closes #1451 #1452 #1449
```

## #1453 Handling

Close as `wontfix` with comment: "No-op filing. Hooks are registered but not wired to agent context. Deferring to M118 when agent instrumentation layer is planned."

## Changelog Impact

With Option B split, release-please will generate:

```
## v7.67.0

### Features
* **skills,#117:** actively use Monitor tool (#1447)
* **analytics,#117:** surface CC 2.1.117 OTEL enrichments (#1448)
* **skills,#117:** integrate PushNotification for long-running completion (#1450)

### Tests & Hygiene
* **hooks,#117:** register CwdChanged + FileChanged for reactive env mgmt (#1449)
* **test,#117:** add property-based tests for hook input validation (#1452)
* **ci,#117:** granular release-please cadence (#1451)
```

Story reads clearly: "CC 2.1.117 adoption landed with three headline features; test infrastructure hardened."

## Summary Table

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| User preference alignment | Exact match | Good (3–5/PR) | Too granular |
| Changelog clarity | Muddled | Clean | Excessive |
| Review cycles | 1 | 2 | 3 |
| Bisect-ability | Hard | Easy | Optimal |
| #1453 handling | Awkward (ship no-op) | Clean (wontfix) | Clean (wontfix) |
| Recommend? | No | **YES** | No |
