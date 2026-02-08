# Issue #245: Tracking System Gaps

Audit Date: 2026-01-29
Branch: `test/dispatcher-registry-wiring-tests`

## Summary

~40% of the tracking infrastructure was initially connected. Progress tracking below.

**Fixed:** 12/13 gaps (GAP-001 through GAP-012)
**Deferred:** 1/13 gaps (GAP-013 - low priority code smell)

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
- **Written by**: ~~`src/hooks/src/prompt/capture-user-intent.ts:164` (storeDecisions)~~ REMOVED
- **Read by**: N/A (data flows through events.jsonl via trackDecisionMade)
- **Status**: [x] Fixed - Removed storeDecisions, data tracked via session-tracker
- **Impact**: User decisions captured but never incorporated into profile
- **Fix**: Removed dead-end write; decisions tracked via trackDecisionMade → events.jsonl

### GAP-004: user-preferences.jsonl never read
- **Written by**: ~~`src/hooks/src/prompt/capture-user-intent.ts:192` (storePreferences)~~ REMOVED
- **Read by**: N/A (data flows through events.jsonl via trackPreferenceStated)
- **Status**: [x] Fixed - Removed storePreferences, data tracked via session-tracker
- **Impact**: User preferences captured but never incorporated into profile
- **Fix**: Removed dead-end write; preferences tracked via trackPreferenceStated → events.jsonl

### GAP-005: open-problems.jsonl never read
- **Written by**: `src/hooks/src/prompt/capture-user-intent.ts` (storeProblems)
- **Read by**: `src/hooks/src/lib/problem-tracker.ts` (wired via GAP-011)
- **Status**: [x] Fixed - File read by problem-tracker (wired to posttool dispatcher in GAP-011)
- **Impact**: Problems detected but never tracked or resolved
- **Fix**: Already wired via GAP-011 solution-detector → problem-tracker

### GAP-006: mem0-queue.jsonl never processed
- **Written by**: `src/hooks/src/lib/memory-writer.ts:89` (queueForMem0)
- **Read by**: `src/hooks/src/stop/mem0-queue-sync.ts`
- **Status**: [x] Fixed
- **Impact**: Cloud memory sync completely broken - nothing ever uploads
- **Fix**: Created `stop/mem0-queue-sync.ts` with dispatcher wiring (gated by MEM0_API_KEY)

---

## P2: Medium - Dead Code (Never Called)

### GAP-007: trackSolutionFound() never called
- **Defined**: `src/hooks/src/lib/session-tracker.ts:278-289`
- **Called by**: `src/hooks/src/lib/problem-tracker.ts:pairSolutionWithProblems`
- **Status**: [x] Fixed - Wired to problem-tracker when solution paired
- **Impact**: Problems reported but solutions never paired - no learning loop
- **Fix**: Added call to trackSolutionFound in pairSolutionWithProblems

### GAP-008: listSessionIds() never called
- **Defined**: ~~`src/hooks/src/lib/session-tracker.ts:490-504`~~ REMOVED
- **Called by**: Tests only (production code never used it)
- **Status**: [x] Fixed - Removed dead code
- **Impact**: Query utility exists but unused
- **Fix**: Removed function and tests; cross-session queries should use profile-injector if needed

### GAP-009: getRecentUserSessions() never called
- **Defined**: ~~`src/hooks/src/lib/session-tracker.ts:509-532`~~ REMOVED
- **Called by**: Tests only (production code never used it)
- **Status**: [x] Fixed - Removed dead code
- **Impact**: Cross-session queries impossible
- **Fix**: Removed function; functionality can be added to profile-injector if needed

### GAP-010: getRecentFlows() never called
- **Defined**: ~~`src/hooks/src/lib/decision-flow-tracker.ts:536-562`~~ REMOVED
- **Called by**: Nothing (dead code)
- **Status**: [x] Fixed - Removed dead code
- **Impact**: Historical workflow analysis impossible
- **Fix**: Removed function; cross-session flow analysis can be added to workflow-preference-learner if needed

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
- **Status**: [ ] Deferred (P3 low priority)
- **Impact**: Code duplication, potential drift
- **Decision**: Keep as-is for now
  - Both implementations are tested and working
  - run-hook.mjs is ESM entrypoint that needs standalone implementation
  - Consolidation would require refactoring run-hook.mjs import structure
  - Risk of breaking hooks system outweighs benefit
- **Future**: Consider consolidation when refactoring hook system

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
| GAP-003 | pending-decisions reader | [x] | pending |
| GAP-004 | user-preferences reader | [x] | pending |
| GAP-005 | open-problems reader | [x] | bb14493c (via GAP-011) |
| GAP-006 | mem0-queue processor | [x] | 0d0101a4 |
| GAP-007 | trackSolutionFound caller | [x] | pending |
| GAP-008 | listSessionIds usage | [x] | pending |
| GAP-009 | getRecentUserSessions usage | [x] | pending |
| GAP-010 | getRecentFlows usage | [x] | pending |
| GAP-011 | problem-tracker module | [x] | bb14493c |
| GAP-012 | duplicate trackSessionEnd | [x] | c69dc03d |
| GAP-013 | trackHookTriggered consolidation | [-] | deferred |
