---
name: M117 Release Shape Analysis
description: Release cadence decision + PR bundling strategy for CC 2.1.117 adoption milestone
type: project
---

## Milestone M117 Context

**Milestone 117**: CC 2.1.117 adoption + idiom lag sweep
- Open issues: 8 (as of 2026-04-24)
- Closed issues: 12
- Due date: None set
- Pattern: Bundle related issues (user established preference in #1376, #1378, #1380)

## Issues Breakdown

### High User Value (Tier A — Adoption)
- #1447: feat(skills): actively use Monitor tool in ork:implement/cover/verify
- #1448: feat(analytics): surface CC 2.1.117 OTEL enrichments in ork:analytics
- #1450: feat(skills): integrate PushNotification for long-running skill completion

### Infrastructure/Hygiene (Tier B — Quality)
- #1451: chore(ci): granular release-please cadence (weekly cron or size-trigger)
- #1452: test(hooks): add property-based tests for hook input validation
- #1449: feat(hooks): register CwdChanged + FileChanged for reactive env mgmt

### Deferred (Tier C — Filed but no-op)
- #1453: feat(hooks): register Setup + SubagentStart + InstructionsLoaded + TaskCreated (optional)
- #1462: feat(doctor): warn when .mcp.json pins @latest on HIGH-tier MCPs (separate, not in M117)

## Release History

Last release: 7.66.0 (2026-04-23)
Prior burst: 7.60.0 → 7.63.0 in 2 days (2026-04-20 to 2026-04-22)

Issue: Users upgrading on-demand miss intermediate changelog entries when multiple releases compress into rapid succession.

## User Preference

Established pattern: Bundle related issues per PR, track in milestone, close with `Closes #A #B #C` in PR body.
PRs #1376 (4 issues), #1378 (5 issues), #1380 (3 issues) all followed this model.

## Decision Needed

1. **Release cadence** — Which of 4 options for #1451?
2. **PR bundling** — Single 7-issue PR, or split by theme? How does deferred #1453 factor in?
