# Unified Security Audit Report: Hooks Subsystem

**Date**: 2026-02-06
**Method**: Agent Teams — 3 parallel auditors with peer cross-referencing
**Scope**: 119 hooks across `src/hooks/` (91 global + 22 agent + 6 skill-scoped)

## Auditors

| Auditor | Focus | Findings |
|---------|-------|----------|
| security-auditor | OWASP Top 10, dependencies, secrets, injection | 5 findings (0C, 0H, 2M, 3L) |
| security-layer-auditor | 8-layer defense-in-depth matrix | 7 findings (0C, 0H, 3M, 3L, 1VL) — updated after cross-ref |
| ai-safety-auditor | OWASP LLM Top 10, prompt injection, tool poisoning | 7 findings + 3 positive (0C, 0H, 3M, 2L, 2I) — AIS-004 upgraded |

---

## Executive Summary

| Severity | Count | Confidence |
|----------|-------|------------|
| Critical | 0 | - |
| High | 0 | - |
| Medium | 5 | 2 corroborated (3 auditors), 3 single-auditor |
| Low | 4 | 4 single-auditor |
| Info | 2 | Acceptable risk |
| Positive | 3 | Strong security practices |

**Overall risk rating: LOW-MEDIUM**. No critical or high findings. All medium findings require local filesystem access as a prerequisite, significantly limiting the attack surface.

**Dependencies**: CLEAN (0 CVEs across 112 packages)
**Secrets**: CLEAN (no hardcoded secrets in production source)

---

## Cross-Referenced Findings (sorted by severity)

### UF-001: Context/Memory Injection Without Sanitization (MEDIUM)
**Corroborated by: 3/3 auditors** (security-layer-auditor F1, ai-safety-auditor AIS-001, security-auditor F5)

| Attribute | Value |
|-----------|-------|
| Severity | Medium |
| Confidence | HIGH (all 3 auditors independently identified) |
| OWASP | LLM01 Prompt Injection |
| Layer | 5 (LLM/Prompt) |
| Locations | `prompt/memory-context-loader.ts:62-88`, `prompt/profile-injector.ts:294-323`, `prompt/memory-context.ts` |

**Description**: Hooks read from local JSONL/JSON files (`.claude/memory/decisions.jsonl`, user profile, knowledge graph) and inject content directly into LLM context via `outputPromptContext()` / `additionalContext`. No sanitization of injected content. A malicious entry like `"what": "IMPORTANT: Ignore all previous instructions..."` would be injected verbatim.

**Mitigations present**: Content truncation (MAX_CONTEXT_CHARS = 3000/1200), JSON parsing rejects malformed entries, files are under user control (not externally writable without local access).

**Remediation**: Strip instruction-like patterns (`## System`, `IMPORTANT:`, XML-like tags, markdown directives) from injected content. Add content-type validation layer.

### UF-002: Shell Injection via project_dir in execSync (MEDIUM)
**Single auditor: security-auditor F1**

| Attribute | Value |
|-----------|-------|
| Severity | Medium |
| OWASP | A03:2021 Injection |
| Layer | 3 (Authorization/Execution) |
| Locations | `stop/multi-instance-cleanup.ts:24`, `stop/security-scan-aggregator.ts:150` |

**Description**: `execSync(sqlite3 "${dbPath}" ...)` passes `dbPath` derived from `input.project_dir` through shell string interpolation. Double quotes prevent basic injection but not `$(cmd)` or backtick expansion.

**Mitigations present**: `project_dir` set by Claude Code runtime; `instanceId` validated with SAFE_ID_PATTERN.

**Remediation**: Use `execFileSync` with argument arrays instead of shell string interpolation, or validate `projectDir` with path-safe regex.

### UF-003: Hook Override Can Disable Security-Critical Hooks (MEDIUM)
**Single auditor: ai-safety-auditor AIS-003**

| Attribute | Value |
|-----------|-------|
| Severity | Medium |
| OWASP | LLM05 Supply Chain |
| Layer | 3 (Authorization) |
| Location | `bin/run-hook.mjs:153-169` |

**Description**: `.claude/hook-overrides.json` can disable ANY hook by name, including security-critical ones (dangerous-command-blocker, file-guard). Requires local file write access.

**Remediation**: Implement "security-critical" hook tier that cannot be disabled. The `HookMeta.tier` field already has `'security-critical'` as a value — wire into `isHookDisabled()`.

### UF-004: Regex Injection via learned-patterns.json (MEDIUM)
**Corroborated by: 2/3 auditors** (security-auditor F2, ai-safety-auditor AIS-002)

| Attribute | Value |
|-----------|-------|
| Severity | Medium |
| OWASP | A01:2021 Broken Access Control |
| Layer | 3 (Authorization) |
| Location | `permission/learning-tracker.ts:70-72` |

**Description**: `shouldAutoApprove()` constructs `new RegExp(pattern)` from strings in `learned-patterns.json`. Tampered file could cause ReDoS or auto-approve dangerous commands bypassing the security blocklist.

**Mitigations present**: Security blocklist covers critical cases; file requires local filesystem access.

**Remediation**: Add regex complexity limits, or use string prefix matching instead of arbitrary regex. Consider signing the patterns file.

### UF-005: Secret Detection is Warn-Only + Memory Persistence (MEDIUM)
**Corroborated by: 3/3 auditors** (security-layer-auditor F2, ai-safety-auditor AIS-004, security-auditor F3)
**Upgraded from LOW after cross-reference round** (ai-safety-auditor identified memory persistence chain)

| Attribute | Value |
|-----------|-------|
| Severity | **Medium** (upgraded from Low) |
| Confidence | HIGH (all 3 auditors independently identified) |
| OWASP | A02:2021 / LLM06 |
| Layer | 6 (Output) |
| Location | `skill/redact-secrets.ts:31-53` |

**Description**: `redactSecrets()` detects API keys but only warns via stderr. Does not block output, redact content, or prevent secrets from entering Claude's context.

**Memory persistence chain** (identified in cross-reference round): Secrets in tool output can persist across sessions: `cat .env` → secrets in output → `capture-user-intent` stores decisions → `memory-context-loader` re-injects in future sessions. This extends the impact beyond a single session.

**Remediation**:
- Short-term: Add PreToolUse hook blocking `cat .env`, `printenv`, `echo $SECRET_*` patterns
- Medium-term: Add secret pattern detection to `capture-user-intent` to skip storing entries containing API keys
- Long-term: Investigate CC PostToolUse API for output modification/redaction capability
- Rename to `detect-secrets` for accuracy

### UF-006: Dangerous Command Blocker Encoding Bypasses (LOW)
**Single auditor: security-auditor F4**

| Attribute | Value |
|-----------|-------|
| Severity | Low |
| OWASP | A03:2021 Injection |
| Layer | 3 (Authorization) |
| Location | `pretool/bash/dangerous-command-blocker.ts:60-109` |

**Description**: Blocker normalizes and lowercases commands but doesn't handle hex/octal escapes (`$'\x72\x6d'`), variable expansion (`$cmd`), or base64-pipe patterns.

**Mitigations present**: Claude Code's own permission system is the primary gate; compound-command-validator adds another layer.

**Remediation**: Add variable-expansion detection and base64-pipe patterns. Document known limitations.

### UF-007: guardPathPattern Regex from Developer Strings (LOW)
**Single auditor: security-layer-auditor F3**

| Attribute | Value |
|-----------|-------|
| Severity | Low |
| Layer | 2 (Input) |
| Location | `lib/guards.ts:120-135` |

**Description**: Glob-to-regex conversion doesn't protect against ReDoS if patterns are ever user-supplied (currently developer-hardcoded only).

### UF-008: fetchRobotsTxt Shell Command with URL (LOW)
**Single auditor: security-layer-auditor F4**

| Attribute | Value |
|-----------|-------|
| Severity | Low |
| Layer | 1 (Edge) |
| Location | `pretool/bash/agent-browser-safety.ts:302` |

**Description**: `execSync(curl -sL "${robotsUrl}")` — URL comes from validated `new URL().origin` but pattern is fragile.

### UF-009: File Lock TOCTOU Race Window (INFO)
**Single auditor: security-layer-auditor F5**

| Attribute | Value |
|-----------|-------|
| Severity | Info |
| Layer | 7 (Storage) |
| Location | `pretool/write-edit/multi-instance-lock.ts:157-217` |

**Description**: Read-check-write cycle for locks is not truly atomic. Extremely narrow window, self-healing via 5-min expiry.

### UF-010: Background Hook Base64 CLI Args (INFO)
**Single auditor: ai-safety-auditor AIS-006**

| Attribute | Value |
|-----------|-------|
| Severity | Info |
| Location | `bin/run-hook-silent.mjs:103-126` |

**Description**: Hook input passed as base64 CLI argument, visible in `ps` output to same-user processes.

---

## Positive Security Findings

| Practice | Location | Auditor(s) |
|----------|----------|------------|
| Session ID path traversal prevention (`^[a-zA-Z0-9_-]{1,128}$`) | `bin/run-hook.mjs:176-186` | All 3 |
| Symlink resolution in file guard (`realpathSync`) | `pretool/write-edit/file-guard.ts:48-64` | All 3 |
| Command normalization prevents evasion | `lib/common.ts:488-494` | All 3 |
| Path containment via `path.relative()` not string prefix | `permission/auto-approve-project-writes.ts` | 2/3 |
| `execSync` timeouts on all shell commands | Multiple files | 1/3 |
| Fail-safe: hooks never block on internal errors | All hooks | 1/3 |
| Defense-in-depth: 4+ overlapping security layers for commands | pretool/bash/ | All 3 |

---

## Compliance Matrices

### OWASP Top 10 (2021)

| Category | Status | Key Controls |
|----------|--------|-------------|
| A01 Broken Access Control | PASS | file-guard, permission hooks, path containment |
| A02 Cryptographic Failures | PARTIAL | Secret detection exists but warn-only |
| A03 Injection | PARTIAL | Command blocker + normalization, but encoding edge cases |
| A04 Insecure Design | PASS | Intentional fail-open, defense-in-depth |
| A05 Security Misconfiguration | PASS | hook-overrides is by-design, local-only |
| A06 Vulnerable Components | PASS | 0 CVEs |
| A07 Auth Failures | N/A | Local process, no auth needed |
| A08 Data Integrity | PASS | Acceptable for local threat model |
| A09 Logging Failures | PASS | Comprehensive audit trail |
| A10 SSRF | PASS | Minimal external fetch, validated URLs |

### OWASP LLM Top 10 (2025)

| Category | Status |
|----------|--------|
| LLM01 Prompt Injection | PARTIAL |
| LLM02 Insecure Output | PASS |
| LLM03 Training Data Poisoning | N/A |
| LLM04 Model DoS | PASS |
| LLM05 Supply Chain | PARTIAL |
| LLM06 Sensitive Info Disclosure | PARTIAL |
| LLM07 Insecure Plugin Design | PASS |
| LLM08 Excessive Agency | PASS |
| LLM09 Overreliance | PASS |
| LLM10 Model Theft | N/A |

### Defense-in-Depth (8 Layers)

| Layer | Status |
|-------|--------|
| 0 Edge | N/A (local hooks) |
| 1 Gateway | N/A (browser-safety for agents) |
| 2 Input | PASS |
| 3 Authorization | PASS |
| 4 Data Access | PASS |
| 5 LLM/Prompt | PARTIAL |
| 6 Output | PARTIAL |
| 7 Storage | PASS |
| 8 Observability | PASS |

---

## Prioritized Remediation Plan

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| P1 | UF-001: Sanitize `outputWithContext()`/`outputPromptContext()` in common.ts | Medium | Single chokepoint — closes ALL context injection vectors at once |
| P2 | UF-005: Block secret-exposing commands + detect in memory pipeline | Low | Prevents cross-session secret persistence |
| P3 | UF-002: Use execFileSync for shell commands | Low | Eliminates injection class |
| P4 | UF-003: Protect security-critical hooks from overrides | Low | Closes supply chain gap |
| P5 | UF-004: Validate learned-patterns.json regex | Low | Prevents ReDoS + permission bypass |
| P6 | UF-006: Add encoding detection to command blocker | Medium | Defense-in-depth improvement |

---

## Cross-Reference Addendum (Round 2)

After initial reports were shared, auditors performed a second round of cross-referencing. Key outcomes:

### Severity Upgrade: UF-005
ai-safety-auditor upgraded secret detection from LOW to MEDIUM after identifying a memory persistence chain where secrets could survive across sessions via the `capture-user-intent` → `decisions.jsonl` → `memory-context-loader` pipeline.

### New Corroboration: UF-002, UF-004
security-layer-auditor independently verified the shell injection (F6) and regex injection (F7) findings from security-auditor, adding Layer mapping and confirming the `SAFE_ID_PATTERN` validation gap for `projectDir`.

### Disagreement Resolved: Auto-Approve Execution Order
security-auditor flagged that `auto-approve-safe-bash` matching `^git status` could match `git status && rm -rf /`. ai-safety-auditor **correctly refuted this**: PreToolUse hooks (dangerous-command-blocker, compound-command-validator) run before PermissionRequest hooks (auto-approve) in CC's lifecycle — a PreToolUse deny stops execution entirely before auto-approve fires. **Verdict: NOT A GAP.** Hardening suggestion: tighten auto-approve regex to reject `&&`, `||`, `|`, `;`.

### Single Chokepoint Identified
ai-safety-auditor identified `outputWithContext()` / `outputPromptContext()` in `lib/common.ts:163-245` as the single chokepoint for all context injection. Sanitizing at this layer would protect all downstream hooks at once — recommended as the P1 remediation approach.

---

## Methodology Notes

This audit used CC Agent Teams with 3 specialized agents running in parallel:
- Agents ran as in-process teammates (sonnet model)
- security-layer-auditor shared Layer 5 findings with ai-safety-auditor for cross-reference
- security-auditor shared injection findings with ai-safety-auditor for cross-reference
- All agents operated read-only (no file modifications)
- Lead synthesized reports with deduplication and confidence scoring
