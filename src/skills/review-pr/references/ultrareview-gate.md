# /ultrareview Gate (CC 2.1.111+, optional)

Claude Code 2.1.111 ships a built-in `/ultrareview` — parallel multi-agent deep review (Pro/Max users get 3 free per month). It overlaps this skill's Phase 3 but goes deeper. It's not free, so never fire it by default — offer it only when a trigger justifies the cost, and always ask the user before burning a quota.

Reliability note (CC 2.1.212): `/ultrareview <PR#>` PR references parse correctly, branch fetch works for branches not checked out locally, and billing no longer misfires after `/clear`.

## Trigger evaluation (automatic, Phase 2.5, BEFORE the review call)

The shell owns every question to the user, so the ask happens before the `workflows/review-fanout.js` call, from the PR metadata Phase 1 already collected:

```python
triggers = []
if diff_loc_changed > 500:
    triggers.append("large_diff")
if any(path.startswith(p) for path in changed_files
       for p in ["auth/", "migrations/", "hooks/", "crypto/", "security/", "payments/"]):
    triggers.append("sensitive_path")
if any(label in pr_labels for label in ["release", "hotfix"]):
    triggers.append("high_stakes_label")
```

`reviewer_disagreement` needs the reviewers' verdicts, so it cannot fire before the call. The workflow returns it as `reviewerDisagreement`; if it is true and this gate did not ask earlier in the run, the shell may ask in Phase 5 with the same prompt and reason `reviewer_disagreement`.

If `triggers` is empty → **skip** the gate entirely and proceed to Phase 3. Never mention `/ultrareview` to the user.

## When triggers fire: voice-friendly prompt

Read session state: `Read(".claude/state/ultrareview-usage.json")` (may not exist). If `month == currentMonth()` and `skip_session == true`, **skip the prompt** and proceed to Phase 3. Otherwise:

```python
AskUserQuestion(questions=[{
  "question": f"This PR triggers /ultrareview (reason: {', '.join(triggers)}). Run it? (Pro/Max: 3 free per month.)",
  "header": "Ultrareview",
  "multiSelect": false,
  "options": [
    {"label": "Yes, run ultrareview",
     "description": "Invoke built-in /ultrareview as a final deep pass. Adds 5–10 min."},
    {"label": "No, skip it",
     "description": "Continue with the Phase 3 review without it."},
    {"label": "Skip for this session",
     "description": "Don't ask again until this session ends."}
  ]
}])
```

Why `AskUserQuestion` and not a `--ultra` flag: the user relies on voice, so "yes"/"no"/"skip for session" is speakable whereas flags are not.

## After user response

- **Yes** → ask the user to type `/code-review ultra <PR>` themselves: it is user-triggered and billed, and the post gate denies it from inside this skill. Merge any findings they paste back with Phase 3 results in Phase 5 (label them "Ultrareview:").
- **No** → proceed to Phase 3 unchanged.
- **Skip for this session** → write `.claude/state/ultrareview-usage.json`:
  ```json
  { "month": "2026-04", "session_skip": true, "last_asked": "<iso>" }
  ```
  Then proceed to Phase 3.

On every run where the user said "Yes", increment the month counter so we advise against a third ask in the same month:

```json
{ "month": "2026-04", "used_this_month": 2, "last_used": "<iso>" }
```

This is advisory only — we cannot query Anthropic's real quota. When `used_this_month >= 3`, the AskUserQuestion text changes the third option to warn: *"You may have exhausted the monthly free quota."*

## Opt-out

Set `ORK_DISABLE_ULTRAREVIEW=1` or `.claude/settings.json` → `"ork.disableUltrareview": true` to skip the gate entirely regardless of triggers. Honored at the top of this phase.
