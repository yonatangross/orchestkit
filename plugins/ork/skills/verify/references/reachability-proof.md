# Reachability Proof (REACHED vs UNREACHED)

The [Verification Manifest](verification-manifest.md) closes one seam: *did the lead
actually re-run the claim, or relay someone else's assertion?* It does not close the
second seam, and the second seam is the one that ships bugs:

> `✅ VERIFIED · uv run pytest tests/unit -q · exit 0 · 214 passed`

That row is honest. The lead ran it, read the output, cited the key line. And it can
still be worthless, because **a suite passing does not mean the suite exercised the
change**. A green test that never reaches the new code is a proxy signal standing in for
correctness. The manifest grades *who ran it*. Reachability grades *whether the green
means anything*.

This is not hypothetical. A validator shipped 2026-07-19 was fully defined, fully
tested, and never called at its call site. Every test passed while exercising the old
path. The suite was green, the manifest would have read VERIFIED, and the feature was
inert.

## The two axes

| | Question | States |
|---|---|---|
| **Provenance** (manifest) | Did the *lead* run this, or relay it? | ✅ VERIFIED · 🟡 CLAIMED · ⬜ UNCHECKED · ⚪ WAIVED |
| **Reachability** (this doc) | Would this test *fail* if the change were absent? | 🟢 REACHED · 🟡 UNREACHED · ⚪ WAIVED |

A row can be VERIFIED and UNREACHED at the same time. That combination is the most
dangerous state in the report, because it looks like the strongest one.

## Scope: which claims need a reachability proof

Only tests that are **new or modified in the diff under verification**. An untouched
regression suite does not need one; it is not being offered as evidence that *this*
change works.

Concretely, a proof is required for each test file the diff adds or edits, and for any
claim of the form "the fix is covered" / "there is a test for this."

## The proof

A test is 🟢 REACHED when the run has shown it **fail without the change and pass with
it**. Nothing weaker counts. Not "the test looks like it covers this." Not "coverage
reports the line." Seeing it fail is the proof.

```
1. COMMIT the change first.          # non-negotiable, see below
2. Mutate the CALL SITE.             # not the new unit, see below
3. Run the test  ->  expect RED.     # this is the proof
4. git checkout -- <mutated file>    # restores to HEAD == the committed change
5. Run the test  ->  expect GREEN.
```

Record both runs in the manifest row. A proof with only step 5 is not a proof.

### Rule 1: commit before mutating

`git checkout -- <file>` restores the file to **HEAD**, not to the working state you had
before the mutation. If the change is still uncommitted when you mutate, step 4 reverts
the mutation *and the change together*, silently destroying the work. This has already
cost a real fix plus roughly forty lines of a new guard in one stroke.

Commit first, then mutate, then restore. The order is the safety property.

### Rule 2: mutate the call site, not the new unit

The failure this proof exists to catch is *new code that is never invoked*. Mutating the
new unit proves only that the unit's own tests exercise the unit, which was never in
doubt. It leaves the actual defect, a dead call site, completely undetected.

Mutate where the new code is **called from**:

| Change | Weak mutation (proves little) | Correct mutation |
|---|---|---|
| New validator function | break the validator body | delete the call to it in the handler |
| New middleware | break the middleware logic | remove it from the middleware chain |
| New guard clause | invert the guard's condition | remove the guard entirely |
| New config flag read | change the default | delete the branch that reads it |

If deleting the call site does **not** turn the test red, the test is not testing the
change.

### What a good mutation looks like

It must be **semantically load-bearing**, not cosmetic. Renaming a local variable,
touching a comment, or reformatting proves nothing. Delete the call, invert the
condition, or return the opposite value.

It must also be **exactly one thing**. Two simultaneous mutations produce a red you
cannot attribute.

## Verify does not perform the mutation

`ork:verify` writes no test files and edits no source. That contract is not relaxed
here. Verify **grades** the reachability proof; it does not produce one.

- The proof is produced by whoever wrote the code, typically `/ork:implement` or
  `/ork:cover`, and carried into the run as evidence.
- If no proof exists, verify marks the row 🟡 UNREACHED and the verdict is capped. It
  does not mutate the tree to manufacture one.

This keeps verify read-only and puts the burden where the knowledge is. A skill that
edited source to grade itself would be the same category error the proof exists to
catch.

## The rule (wired to the verdict)

> **A test added or modified by this diff that is 🟡 UNREACHED caps the verdict at
> IMPROVEMENTS RECOMMENDED. It cannot grade READY FOR MERGE until the proof is shown or
> the row is explicitly ⚪ WAIVED with a reason.**

This stacks with the existing gates rather than replacing them: dimension blockers, the
provenance cap, and this reachability cap must all clear. Under `--streak=N`, a run
carrying an UNREACHED new test is not READY and therefore resets the streak to 0.

## Template

Extend the manifest with a Reached column. Leave it blank (`n/a`) for rows that are not
test-coverage claims.

```markdown
## Verification Manifest

| # | Load-bearing claim | Asserted by | Provenance | Reached | Evidence (cmd · exit · key line) |
|---|---|---|---|---|---|
| 1 | Types check clean (web) | frontend-ui-dev | ✅ VERIFIED | n/a | `pnpm --filter web type-check` · exit 0 · 0 errors |
| 2 | New portal-auth guard is covered | test-generator | ✅ VERIFIED | 🟢 REACHED | deleted `get_portal_context` call in routes/portal.py:44 · `pytest tests/unit/routes/test_portal.py` · exit 1 · 3 failed · restored · exit 0 · 3 passed |
| 3 | Retry logic is covered | test-generator | ✅ VERIFIED | 🟡 UNREACHED | suite green, but no failing run shown → **caps verdict** |
| 4 | Legacy suite still green | ci | ✅ VERIFIED | n/a | untouched by this diff |

**Manifest verdict impact:** row 3 is a new test with no reachability proof →
verdict capped at IMPROVEMENTS RECOMMENDED until REACHED or WAIVED.
```

Row 3 is the entire point. It is VERIFIED, it is green, and it is still not evidence.

## Anti-patterns

- **Coverage as proof.** A line-coverage report says a line executed, not that an
  assertion would fail if the behaviour changed. Coverage is not reachability.
- **Mutating the new unit.** Passes the ritual, misses the dead call site. See Rule 2.
- **Mutating before committing.** Destroys the change on restore. See Rule 1.
- **Cosmetic mutation.** A renamed variable that still turns the test red means the test
  is asserting on the wrong thing, which is its own finding, not a pass.
- **Proof by assertion.** "I verified the test fails without the fix" with no command and
  no exit code is 🟡 CLAIMED provenance *and* 🟡 UNREACHED. Both caps apply.
- **Batch proof.** One mutation and a whole-suite red does not prove which test caught
  it. Prove per claim, and name the test that went red.

## Effort scaling

| `/effort` | Reachability |
|---|---|
| **low** | Skipped. Note in the report that reachability was not graded. |
| **medium** | Required for new tests covering the diff's primary behaviour change. |
| **high** / **xhigh** | Required for every test the diff adds or modifies. |

At every level, an UNREACHED row that is *present* still caps the verdict. The effort
level controls how many rows you are obliged to open, not whether the cap applies.
