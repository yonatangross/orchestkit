# Compatibility Matrix Reference

Template for tracking model, Claude Code, and OrchestKit version compatibility. Use this matrix to document which combinations have been validated and identify known issues.

---

## Model x CC Version Matrix

Track which Claude models are validated with which Claude Code versions.

| Model | CC 2.1.16 | CC 2.1.25 | CC 2.1.30 | CC 2.1.32 | Notes |
|-------|-----------|-----------|-----------|-----------|-------|
| Claude 3.5 Sonnet v2 | PASS | PASS | PASS | PASS | Legacy, all versions compatible |
| Claude 3.5 Haiku | PASS | PASS | PASS | PASS | Legacy, all versions compatible |
| Claude Sonnet 4 | PASS | PASS | PASS | PASS | Extended thinking requires CC 2.1.10+ |
| Claude Opus 4 | PASS | PASS | PASS | PASS | Extended thinking requires CC 2.1.10+ |
| Claude Sonnet 4.5 | N/A | PASS | PASS | PASS | 1M context requires CC 2.1.25+ |
| Claude Opus 4.6 | N/A | WARN | PASS | PASS | 128K output requires CC 2.1.30+; full features require CC 2.1.32+ |

**Legend:**
- **PASS** - Fully compatible, all features work
- **WARN** - Compatible but some features unavailable or degraded
- **FAIL** - Known incompatibility, do not use this combination
- **N/A** - Model not yet released at this CC version

---

## CC Version x OrchestKit Version Matrix

Track which OrchestKit versions are validated with which Claude Code versions.

| OrchestKit | CC 2.1.16 | CC 2.1.25 | CC 2.1.30 | CC 2.1.32 | Notes |
|------------|-----------|-----------|-----------|-----------|-------|
| 4.x | PASS | PASS | WARN | WARN | No lifecycle hooks, no memory auto-write |
| 5.x | FAIL | PASS | PASS | PASS | Requires CC 2.1.25+ for async dispatchers |
| 6.x | FAIL | FAIL | WARN | PASS | Requires CC 2.1.32+ for skill budget scaling |

---

## Feature Availability Matrix

Track which features are available in which model + CC version combinations.

| Feature | Required Model | Required CC | OrchestKit Support |
|---------|---------------|-------------|-------------------|
| Basic skills | Any | 2.0.x+ | All versions |
| `context: fork` | Any | 2.1.0+ | 3.x+ |
| Agent-scoped hooks | Any | 2.1.10+ | 5.x+ |
| Skill-scoped hooks | Any | 2.1.16+ | 5.x+ |
| Fire-and-forget dispatchers | Any | 2.1.25+ | 5.x+ |
| Memory auto-write | Any | 2.1.30+ | 6.x+ |
| Skill budget scaling | Any | 2.1.32+ | 6.x+ |
| Prompt hooks | Any | 2.1.32+ | 6.x+ |
| Extended thinking | Sonnet 4+ / Opus 4+ | 2.1.10+ | 5.x+ |
| 1M context window | Sonnet 4.5+ / Opus 4.6 | 2.1.25+ | 6.x+ |
| 128K output tokens | Opus 4.6 | 2.1.30+ | 6.x+ |
| Vision (image input) | Claude 3+ | 2.0.x+ | All versions |
| PDF input | Sonnet 3.5 v2+ | 2.1.0+ | 4.x+ |
| Files API | Opus 4.6 | 2.1.32+ | 6.x+ |

---

## Hook Type Compatibility

Track which hook types are available across CC versions.

| Hook Type | CC 2.0.x | CC 2.1.0 | CC 2.1.10 | CC 2.1.16 | CC 2.1.25 | CC 2.1.32 |
|-----------|----------|----------|-----------|-----------|-----------|-----------|
| PreToolUse | YES | YES | YES | YES | YES | YES |
| PostToolUse | YES | YES | YES | YES | YES | YES |
| PermissionRequest | NO | YES | YES | YES | YES | YES |
| Notification | NO | YES | YES | YES | YES | YES |
| Stop | NO | NO | YES | YES | YES | YES |
| Lifecycle | NO | NO | NO | YES | YES | YES |
| Prompt | NO | NO | NO | NO | NO | YES |
| Agent-scoped | NO | NO | YES | YES | YES | YES |
| Skill-scoped | NO | NO | NO | YES | YES | YES |
| Async dispatch | NO | NO | NO | NO | YES | YES |

---

## Known Issues Registry

Document known compatibility issues as they are discovered.

### Template Entry

```markdown
### [ISSUE-ID] Short Description

- **Combination:** Model X + CC Y.Z + OrchestKit A.B
- **Severity:** CRITICAL | WARNING | INFO
- **Symptom:** What happens when this combination is used
- **Root Cause:** Why this incompatibility exists
- **Workaround:** Temporary fix if available
- **Fix Version:** Which version resolves this
- **Discovered:** Date
- **Status:** Open | Resolved | Won't Fix
```

### Example: Opus 4.6 Output Truncation on CC 2.1.25

- **Combination:** Claude Opus 4.6 + CC 2.1.25
- **Severity:** WARNING
- **Symptom:** Opus 4.6 supports 128K output tokens, but CC 2.1.25 caps at 64K
- **Root Cause:** CC 2.1.25 has a hardcoded 64K output limit that was raised in 2.1.30
- **Workaround:** Use CC 2.1.30+ for full output capacity
- **Fix Version:** CC 2.1.30
- **Discovered:** 2026-01-20
- **Status:** Resolved

---

## Validation Procedure

When testing a new combination, run through this checklist:

### Quick Validation (5 minutes)

```bash
# 1. Check CC version
claude --version

# 2. Run OrchestKit doctor
/ork:doctor

# 3. Verify hook execution
# Trigger a PreToolUse hook and check logs
```

### Full Validation (30 minutes)

```bash
# 1. Run all tests
npm test

# 2. Run security tests
npm run test:security

# 3. Test user-invocable skills (sample 3-5)
/ork:doctor
/ork:explore
/ork:help

# 4. Test agent spawning
# Create a task with subagent_type to verify agent lifecycle

# 5. Test memory system
# Write to graph memory, verify persistence
# Check MEMORY.md auto-write if CC 2.1.30+

# 6. Test hook execution across types
# PreToolUse: trigger a tool call
# Lifecycle: restart session
# Prompt: check system prompt injection
```

### Regression Validation (1 hour)

```bash
# Full test suite + manual verification of all 22 user-invocable skills
# Run on CI pipeline with target configuration
# Verify all 118 hook entries register without errors
# Test all 36 agents spawn correctly
```

---

## Updating This Matrix

When a new combination is validated:

1. Update the relevant matrix table above
2. Add any discovered issues to the Known Issues Registry
3. Update the `upgrade-assessment` skill if new patterns are found
4. Run `npm run build` to propagate changes to plugins
