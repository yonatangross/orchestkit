# Issue #245: Tracking System Gaps

Audit Date: 2026-01-29
Branch: `test/dispatcher-registry-wiring-tests`

## Summary

~40% of the tracking infrastructure was initially connected. Progress tracking below.

**Fixed:** 4/13 gaps (GAP-001, GAP-002, GAP-011, GAP-012)

---

## P0: Critical - Data Never Reaches Destination

### GAP-001: graph-queue-sync not in Stop dispatcher
- **File**: `src/hooks/src/stop/graph-queue-sync.ts`
- **Status**: [x] Fixed
- **Impact**: Graph memory (MCP) never receives queued entity/relation operations
- **Evidence**: File exists, exports `graphQueueSync`, but not imported in `stop/unified-dispatcher.ts`
- **Fix**: Add to HOOKS array in `stop/unified-dispatcher.ts`

### GAP-002: workflow-preference-learner not in Stop dispatcher
- **File**: `src/hooks/src/stop/workflow-preference-learner.ts`
- **Status**: [x] Fixed
- **Impact**: Workflow patterns detected but never persisted to preferences file
- **Evidence**: File exists, exports `workflowPreferenceLearner`, registered in `hooks.json` but NOT in unified-dispatcher
- **Fix**: Add to HOOKS array in `stop/unified-dispatcher.ts`

---

## P1: High - Write-Only Storage (Dead Ends)

### GAP-003: pending-decisions.jsonl never read
- **Written by**: `src/hooks/src/prompt/capture-user-intent.ts:164` (storeDecisions)
- **Read by**: NOTHING
- **Status**: [ ] Not Fixed
- **Impact**: User decisions captured but never incorporated into profile
- **Data lost**: `what`, `rationale`, `alternatives`, `confidence`, `entities`
- **Fix options**:
  - A) Add reader in session-profile-aggregator to merge into profile.decisions
  - B) Remove the write (simplify)

### GAP-004: user-preferences.jsonl never read
- **Written by**: `src/hooks/src/prompt/capture-user-intent.ts:192` (storePreferences)
- **Read by**: NOTHING
- **Status**: [ ] Not Fixed
- **Impact**: User preferences captured but never incorporated into profile
- **Data lost**: `category`, `preference`, `confidence`
- **Fix options**:
  - A) Add reader in session-profile-aggregator to merge into profile.preferences
  - B) Remove the write (simplify)

### GAP-005: open-problems.jsonl never read
- **Written by**: `src/hooks/src/prompt/capture-user-intent.ts:220` (storeProblems)
- **Read by**: NOTHING
- **Status**: [ ] Not Fixed
- **Impact**: Problems detected but never tracked or resolved
- **Data lost**: `text`, `entities`, `timestamp`
- **Fix options**:
  - A) Add reader and pair with solutions
  - B) Remove the write (simplify)

### GAP-006: mem0-queue.jsonl never processed
- **Written by**: `src/hooks/src/lib/memory-writer.ts:89` (queueForMem0)
- **Read by**: NOTHING
- **Status**: [ ] Not Fixed
- **Impact**: Cloud memory sync completely broken - nothing ever uploads
- **Fix**: Create `stop/mem0-queue-sync.ts` similar to graph-queue-sync

---

## P2: Medium - Dead Code (Never Called)

### GAP-007: trackSolutionFound() never called
- **Defined**: `src/hooks/src/lib/session-tracker.ts:278-289`
- **Called by**: Tests only
- **Status**: [ ] Not Fixed
- **Impact**: Problems reported but solutions never paired - no learning loop
- **Fix**: Call from satisfaction-detector when positive signal follows problem

### GAP-008: listSessionIds() never called
- **Defined**: `src/hooks/src/lib/session-tracker.ts:490-504`
- **Called by**: NOTHING
- **Status**: [ ] Not Fixed
- **Impact**: Query utility exists but unused
- **Fix**: Either use it in profile-injector or remove

### GAP-009: getRecentUserSessions() never called
- **Defined**: `src/hooks/src/lib/session-tracker.ts:509-532`
- **Called by**: NOTHING
- **Status**: [ ] Not Fixed
- **Impact**: Cross-session queries impossible
- **Fix**: Either use it in profile-injector or remove

### GAP-010: getRecentFlows() never called
- **Defined**: `src/hooks/src/lib/decision-flow-tracker.ts:536-562`
- **Called by**: NOTHING
- **Status**: [ ] Not Fixed
- **Impact**: Historical workflow analysis impossible
- **Fix**: Either use in workflow-preference-learner or remove

### GAP-011: problem-tracker.ts entirely unused
- **File**: `src/hooks/src/lib/problem-tracker.ts`
- **Called by**: solution-detector.ts (via pairSolutionWithProblems)
- **Status**: [x] Fixed - Wired solution-detector to PostToolUse dispatcher
- **Impact**: Entire module is dead code
- **Functions**: addProblem, detectSolution, resolveProblem, getOpenProblems
- **Fix**: Wired solution-detector.ts to posttool/unified-dispatcher.ts

---

## P3: Low - Code Smell

### GAP-012: Duplicate trackSessionEnd() calls
- **Location 1**: `src/hooks/src/stop/session-end-tracking.ts:17`
- **Location 2**: `src/hooks/src/stop/session-profile-aggregator.ts:32`
- **Status**: [x] Fixed
- **Impact**: `session_end` event logged twice per session
- **Fix**: Removed from session-profile-aggregator (kept in session-end-tracking)

### GAP-013: trackHookTriggered() exists in two places
- **TypeScript**: `src/hooks/src/lib/session-tracker.ts:224-233`
- **JavaScript**: `src/hooks/bin/run-hook.mjs:198-234`
- **Status**: [ ] Not Fixed
- **Impact**: Confusion, potential drift
- **Fix**: run-hook.mjs should import from compiled session-tracker

---

## What IS Working

| Component | Source | Destination | Status |
|-----------|--------|-------------|--------|
| Tool usage | user-tracking.ts | events.jsonl → profile | ✅ |
| Skill invocations | user-tracking.ts | events.jsonl → profile | ✅ |
| Agent spawns | user-tracking.ts | events.jsonl → profile | ✅ |
| Session start/end | session-tracking.ts | events.jsonl | ✅ |
| Communication style | comm-style-tracker.ts | events.jsonl | ✅ |
| Tool sequences | user-tracking.ts | flows/{sid}.json | ✅ |
| Workflow patterns | decision-flow-tracker.ts | profile.workflow_patterns | ✅ |
| Profile injection | profile-injector.ts | additionalContext | ✅ |

---

## Fix Order

1. **GAP-001 + GAP-002**: Wire dispatchers (15 min)
2. **GAP-012**: Remove duplicate (5 min)
3. **GAP-003 + GAP-004 + GAP-005**: Decision: wire or remove? (30 min)
4. **GAP-006**: Create mem0-queue-sync (30 min)
5. **GAP-007**: Wire trackSolutionFound (15 min)
6. **GAP-011**: Delete or wire problem-tracker (15 min)
7. **GAP-008 + GAP-009 + GAP-010**: Delete unused query functions (10 min)
8. **GAP-013**: Consolidate trackHookTriggered (20 min)

---

## Progress Tracking

| Gap | Description | Fixed | Commit |
|-----|-------------|-------|--------|
| GAP-001 | graph-queue-sync dispatcher | [x] | c55d7973 |
| GAP-002 | workflow-preference-learner dispatcher | [x] | c55d7973 |
| GAP-003 | pending-decisions reader | [ ] | |
| GAP-004 | user-preferences reader | [ ] | |
| GAP-005 | open-problems reader | [ ] | |
| GAP-006 | mem0-queue processor | [ ] | |
| GAP-007 | trackSolutionFound caller | [ ] | |
| GAP-008 | listSessionIds usage | [ ] | |
| GAP-009 | getRecentUserSessions usage | [ ] | |
| GAP-010 | getRecentFlows usage | [ ] | |
| GAP-011 | problem-tracker module | [x] | bb14493c |
| GAP-012 | duplicate trackSessionEnd | [x] | c69dc03d |
| GAP-013 | trackHookTriggered consolidation | [ ] | |
