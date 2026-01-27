# Hooks Improvement Plan

**Score: 7.4/10 (Grade B) -> Target: 8.7/10**
**Created:** 2026-01-27

---

## Phase 1: Foundation (7.4 -> 8.0) ✅ COMPLETE

### [1] Hook-Level Behavioral Tests ✅

**Tier 1 - Security-critical (201 tests):**
- [x] `pretool/bash/dangerous-command-blocker`
- [x] `pretool/write-edit/file-guard`
- [x] `permission/auto-approve-safe-bash`
- [x] `skill/redact-secrets`
- [x] `pretool/bash/git-validator` (consolidated from git-branch-protection)
- [x] `agent/security-command-audit`

**Tier 2 - Data-loss risk (90 tests):**
- [x] `stop/auto-save-context`
- [x] `stop/mem0-pre-compaction-sync`
- [x] `posttool/mem0-webhook-handler`
- [x] `lifecycle/session-context-loader`
- [x] `subagent-stop/retry-handler`

**Tier 3 - Quality gates (78 tests):**
- [x] `skill/coverage-threshold-gate`
- [x] `skill/merge-readiness-checker`
- [x] `subagent-stop/subagent-quality-gate`
- [x] `posttool/unified-error-handler`

**Tier 4 - Everything else:**
- [ ] Remaining ~73 hooks (analytics, learning, suggestions, formatting) — deferred, low-risk hooks

### [4] Doc Sync ✅
- [x] Fix README.md reference to missing `docs/async-hooks.md`
- [x] Verify hook counts in CLAUDE.md match hooks.json (150→152, 31→6 async)
- [x] Fix lifecycle hook count discrepancy (docs said 13, dir has 17 — updated per-category counts)
- [ ] Normalize directory casing (`Write/` vs `write-edit/`) — deferred, cosmetic only

---

## Phase 2: Governance (8.0 -> 8.5) ✅ COMPLETE

### [2] Hook Auto-Discovery
- [x] Add `HookMeta` interface to types.ts
- [x] Add `HookOverrides` interface to types.ts
- [ ] Add `hookMeta` export convention to hook files (gradual migration) — future work
- [x] Build registry validation script (`scripts/validate-registry.mjs`)
- [ ] Auto-generate hooks.json + entry files from metadata — future work
- [ ] Single source of truth = the .ts file itself — future work

### [3] Hook Toggle System
- [x] Create `HookOverrides` schema in types.ts
- [x] Modify `run-hook.mjs` to check overrides before execution
- [x] Support `disabled` array and per-hook `timeouts`
- [x] Gitignore the overrides file (`.claude/hook-overrides.json`)
- [x] Tests for toggle system

---

## Phase 3: Hardening (8.5 -> 9.0) ✅ COMPLETE

### [5] Runtime Input Validation
- [x] Define input schemas per hook event type
- [x] Validate at boundary (JSON.parse -> validate -> hook)
- [x] Fail fast with clear errors on malformed input

### [6] Reduce Dispatcher Indirection (DEFERRED)
- Not worth the churn risk. Dispatchers work fine.

---

## Scoring Reference

| Dimension | Current | Target |
|-----------|---------|--------|
| Correctness | 8 | 9 |
| Maintainability | 7 | 8.5 |
| Performance | 9 | 9 |
| Security | 8 | 9 |
| Scalability | 6 | 8 |
| Testability | 6 | 8.5 |
| **Weighted** | **7.4** | **8.7** |
