# Context Compression Checklist

Use this checklist when implementing or executing context compression.

---

## Pre-Compression Checks

### Should You Compress?

- [ ] **Context utilization > 70%** of budget
- [ ] **Message count > 10** since last compression (or initial)
- [ ] **Not in critical operation** (mid-transaction, awaiting confirmation)
- [ ] **Compression won't break continuity** (user isn't mid-thought)

### Compression Readiness

- [ ] Existing summary is available (or this is first compression)
- [ ] LLM is available for summarization
- [ ] Probe templates are ready for validation
- [ ] Rollback plan exists (keep original until validated)

---

## During Compression

### Message Selection

- [ ] **Identify messages to compress** (older than preserve window)
- [ ] **Preserve recent N messages** (typically 5) without compression
- [ ] **Never compress system prompts** or critical instructions
- [ ] **Include tool outputs** in compression scope (often largest)

### Summary Generation

- [ ] **Use anchored template** with required sections:
  - [ ] Session Intent
  - [ ] Files Modified
  - [ ] Decisions Made
  - [ ] Technical Context
  - [ ] Current State
  - [ ] Blockers/Questions
  - [ ] Errors Encountered
  - [ ] Next Steps

- [ ] **All sections populated** (no "[TBD]" or placeholders)
- [ ] **Specific details preserved** (file paths, error messages, decisions)
- [ ] **Rationale included** for decisions

### Merging (if existing summary)

- [ ] **Merge incrementally** (don't regenerate from scratch)
- [ ] **Preserve existing decisions** (append, don't replace)
- [ ] **Update current state** (replace with latest)
- [ ] **Replace blockers** (only current ones matter)
- [ ] **Deduplicate** merged content

---

## Post-Compression Validation

### Probe-Based Evaluation

- [ ] **Generate probes** from original messages:
  - [ ] File path probes
  - [ ] Decision probes
  - [ ] Error/blocker probes
  - [ ] State probes
  - [ ] Intent probes

- [ ] **Run probe evaluation** against compressed summary
- [ ] **Check critical probes** (100% must pass)
- [ ] **Check overall score** (≥90% target)

### Quality Checks

- [ ] **Summary is readable** by humans
- [ ] **No critical information lost** (verified by probes)
- [ ] **Compression ratio reasonable** (60-80% typical)
- [ ] **Intent still clear** from summary alone

---

## Acceptance Criteria

### Must Pass (Blocking)

- [ ] All **critical probes pass** (100%)
- [ ] **Session intent preserved** clearly
- [ ] **File modifications listed** with specific changes
- [ ] **Key decisions documented** with rationale
- [ ] **Current state accurate** reflects actual progress

### Should Pass (Warning if Failed)

- [ ] Overall probe score ≥90%
- [ ] Error details preserved
- [ ] Technical context sufficient for continuity
- [ ] Next steps are actionable

### Nice to Have

- [ ] Code snippets preserved if referenced later
- [ ] Timestamps on key events
- [ ] Metadata (compression count, ratio) tracked

---

## Red Flags (Do Not Accept)

- ❌ **Critical probe failed** - information loss
- ❌ **Intent is vague** ("working on code")
- ❌ **Files missing** that were definitely modified
- ❌ **Decisions lost** that affect future work
- ❌ **Placeholder text** ("[TBD]", "etc.", "...")
- ❌ **Compression ratio > 95%** (too aggressive)

---

## Recovery Actions

### If Validation Fails

1. **Retry with higher detail level**
   ```python
   summary = anchored_summarize(messages, detail_level="high")
   ```

2. **Reduce compression scope** (keep more messages raw)
   ```python
   preserve_recent = 10  # Instead of 5
   ```

3. **Manual review** for critical sessions
4. **Fallback to sliding window** (preserve recent, drop old)

### If Critical Information Lost

1. **Do not accept compression**
2. **Retrieve original messages** from backup
3. **Identify what caused loss** (probe that failed)
4. **Adjust summarization prompt** to emphasize lost category

---

## Compression Triggers Reference

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Context utilization | 70% | Start compression |
| Target after compression | 50% | Compress until reached |
| Minimum messages | 10 | Don't compress fewer |
| Preserve recent | 5 | Always keep uncompressed |
| Max compression cycles | 10 | Consider session reset |

---

## Quick Decision Tree

```
Context > 70%?
    │
    ├─ NO → Continue without compression
    │
    └─ YES → Messages > 10?
              │
              ├─ NO → Wait for more messages
              │
              └─ YES → Compress
                        │
                        ├─ Generate anchored summary
                        │
                        ├─ Run probe validation
                        │
                        └─ Probes pass?
                            │
                            ├─ YES → Accept summary
                            │
                            └─ NO → Critical failed?
                                    │
                                    ├─ YES → Retry/reject
                                    │
                                    └─ NO → Accept with warning
```

---

## Metrics to Track

| Metric | How to Calculate | Target |
|--------|------------------|--------|
| Compression ratio | 1 - (after/before) | 60-80% |
| Probe pass rate | passed / total | ≥90% |
| Critical failures | count | 0 |
| Tokens saved | before - after | Maximize |
| Task completion | same as uncompressed | 100% |
| Latency overhead | compression time | <2s |

---

## Integration Points

### With TodoWrite

- Sync completed todos into "Decisions Made"
- Reflect in-progress todos in "Current State"
- Pending todos inform "Next Steps"

### With session/state.json (Context Protocol 2.0)

```json
{
  "compression_state": {
    "last_summary": "...",
    "compression_count": 3,
    "probe_score": 0.94,
    "last_compressed_at": "2026-01-05T10:30:00Z"
  }
}
```

### With Agent Handoffs

- Include summary when handing off to sub-agent
- Sub-agent operates in isolated context
- Results merged back into main summary
