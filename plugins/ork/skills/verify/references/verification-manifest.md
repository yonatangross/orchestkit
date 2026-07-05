# Verification Manifest (VERIFIED vs CLAIMED)

The report's agent scores, tool summaries, and every "X is fixed / clean / passing"
sentence are **claims** until the lead independently re-runs the proof. The single
most common verification failure is relaying an agent's assertion as a fact — a
sub-agent reports "tsc clean", the lead copies that into the report, it ships, and it
does **not** work.

The **Verification Manifest** is a provenance ledger that closes that seam. For every
*load-bearing* claim in the run, the lead records whether it was independently
**VERIFIED** (with the exact command + output), merely **CLAIMED** (asserted by an
agent / tool / doc, never re-run), or **UNCHECKED** (assumed). It is the operational
form of the [Verification Gate](../../shared/rules/verification-gate.md) and
[Anti-Sycophancy](../../shared/rules/anti-sycophancy.md) rules — turning "no completion
claims without fresh evidence" from a principle into a filled-in table.

## Definitions

**Load-bearing claim** — one where flipping it false would change the verdict, ship a
bug, or invalidate the merge. You do **not** manifest every trivial statement; you
manifest the claims the merge *rests on*. If in doubt, it's load-bearing.

**Provenance states**

| State | Meaning | Row must include |
|-------|---------|------------------|
| ✅ **VERIFIED** | The **lead** ran the proof **fresh this session** and read the output. | The command · exit code · the key output line |
| 🟡 **CLAIMED** | A sub-agent, tool summary, doc, or memory asserted it — **not** independently re-run by the lead. | Who asserted it |
| ⬜ **UNCHECKED** | Assumed true; nobody ran a proof (e.g. "no other caller depends on this" with no grep). | Why it was assumed |
| ⚪ **WAIVED** | A CLAIMED/UNCHECKED item deliberately accepted as non-blocking. | A one-line reason + issue ref if deferred |

> An agent reporting "PASS" and the lead **copying** that into the manifest is still
> 🟡 CLAIMED — not ✅ VERIFIED. VERIFIED means *the lead* ran it. The distinction is the
> whole point.

## The rule (wired to the verdict)

> **Any load-bearing claim that is 🟡 CLAIMED or ⬜ UNCHECKED caps the verdict at
> IMPROVEMENTS RECOMMENDED — it cannot grade READY FOR MERGE — until it is ✅ VERIFIED
> or explicitly ⚪ WAIVED with a reason.**

This sits *alongside* the dimension-level blockers (see `grading-rubric.md`): a strong
composite score never launders an unverified load-bearing claim into "done." Both gates
must clear. Under `--streak=N`, a run carrying any load-bearing CLAIMED/UNCHECKED item is
not READY and therefore **resets the streak to 0** (consistent with the existing reset
rule).

## How to build it (a synthesis step, after agents return, before the verdict)

1. **Enumerate claims** from three sources:
   - **a. Agent output** — every sub-agent `approval` / score / "PASS" / "clean" /
     "no X found" is a CLAIM by default.
   - **b. The working narrative** — every "X is fixed / passing / done" sentence.
   - **c. Premises the change rests on** — facts pulled from a doc, memory, or prior
     session ("the migration already ran", "the endpoint returns Y"). Docs and memory are
     Tier 2–4 (see the context-precedence rule): **CLAIMED until re-checked at HEAD.**
2. **For each, decide: can I cheaply run the proof now?**
   - Yes → run it **fresh**, capture `command · exit · key line` → ✅ VERIFIED.
   - No → 🟡 CLAIMED / ⬜ UNCHECKED; if load-bearing, it caps the verdict (or ⚪ WAIVE it
     with a reason).
3. **Spend verification on the load-bearing few.** You need not re-run *everything* — you
   need to never *present* a CLAIMED item *as* VERIFIED.

## Template

```markdown
## Verification Manifest

| # | Load-bearing claim | Asserted by | Provenance | Evidence (cmd · exit · key line) |
|---|--------------------|-------------|------------|----------------------------------|
| 1 | Types check clean (web) | frontend-ui-developer | ✅ VERIFIED | `pnpm --filter web type-check` · exit 0 · 0 errors |
| 2 | Unit suite green | test-generator | ✅ VERIFIED | `uv run pytest tests/unit -q` · exit 0 · 214 passed |
| 3 | No N+1 in order_service | backend-system-architect | 🟡 CLAIMED | agent asserted; not re-run → **caps verdict** |
| 4 | Migration a2f1b already applied | memory (2026-07-01) | ⬜ UNCHECKED | Tier-2 premise; re-check at HEAD before relying |
| 5 | Bundle within budget | — | ⚪ WAIVED | deferred, tracked #NNNN (non-blocking) |

**Manifest verdict impact:** rows 3 & 4 are load-bearing and unverified →
verdict capped at IMPROVEMENTS RECOMMENDED until VERIFIED or WAIVED.
```

## Anti-patterns

- **Laundering** — copying an agent's "PASS" into the table as ✅ VERIFIED without
  re-running. That's CLAIMED. VERIFIED is the *lead's* fresh run.
- **Optimism-marking** — flipping everything to ✅ to clear the gate. The manifest
  measures honesty, not confidence. "Should be fine" is ⬜, not ✅.
- **Convenient omission** — leaving a load-bearing claim off the table to dodge the
  verdict cap. The omission *is* the bug the manifest exists to catch.
- **Trusting agent numbers** — a price, model-id, cost, or count emitted by a sub-agent
  is CLAIMED until checked against source. (Sub-agents have fabricated off-by-1000×
  figures and retired model ids.) Central-verify before the row goes ✅.

## Effort scaling

| `/effort` | Manifest |
|-----------|----------|
| **low** (quick check) | Optional — skip unless a claim would block. |
| **medium** | Required for any claim that would block or pass the verdict. |
| **high** / **xhigh** | Full manifest, including doc/memory premises (source c). |
