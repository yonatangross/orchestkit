---
title: PushNotification on Long-Skill Completion
impact: MEDIUM
impactDescription: Alerts the user when long-running skills complete so they don't miss finished work
tags: [push-notification, completion, long-running]
---

# PushNotification on Long-Skill Completion

When a skill's typical runtime exceeds 5 minutes, fire a `PushNotification` at completion. Long runs mean the user has almost certainly context-switched; without the notification, a green run can sit unreviewed for hours.

## When to apply

| Skill runtime | Notify? |
|---|---|
| < 2 min | No — user is still at the terminal. |
| 2–5 min | Optional — only if the skill has parallel agents or external I/O that makes timing unpredictable. |
| > 5 min | **Yes.** Fire a notification at the final synthesis / report step. |

Apply to: `ork:implement`, `ork:audit-full`, `ork:cover`, `ork:demo-producer`, `ork:verify` (runs on large changes), `ork:brainstorm` (deep 7-phase mode).

## Incorrect

```python
# BAD: skill ends silently after a 30-minute run
return final_report  # user is still reading Slack; never sees it
```

## Correct

```python
# GOOD: fire at the final step, with an outcome-summarizing body
PushNotification(
  message=f"ork:implement complete — {FEATURE}: {tests_passing}/{tests_total} tests · ready for /ork:verify",
  status="proactive"
)
return final_report
```

The title names the skill; the body summarizes the outcome in one line. Users filter their notification center by title, so keep it stable: `"ork:<skill> complete"` or `"ork:<skill> needs input"`.

## Graceful fallback

`PushNotification` requires Remote Control with "Push when Claude decides" enabled. Users without it see **no error** — the call is a silent no-op. No try/except needed. Do not branch on capability detection; the tool handles the absence itself.

```python
# GOOD: unconditional call; tool is a no-op when RC is disabled
PushNotification(message="... — ...", status="proactive")

# WRONG: defensive capability check adds complexity for no gain
if has_remote_control():  # this API does not exist
    PushNotification(...)
```

## Body content rules

- **Include an actionable outcome**, not just "done". Bad: `"finished"`. Good: `"47 files changed · all tests green · PR #1492 opened"`.
- **≤ 100 characters** — notification UIs truncate aggressively.
- **No emojis** — they render inconsistently across devices.
- **State the next step** when the skill expects one. Example: `"ready for /ork:verify"` or `"3 conflicts need review"`.

## Why

Users running `/ork:implement` on a medium-sized feature commonly walk away for 20–30 min. A silent completion means either (a) they check back prematurely and see nothing interesting, or (b) they forget entirely. Neither is the point of running the skill.

Remote Control is opt-in — users who have enabled it have explicitly signaled they want these notifications. Skipping the call for "safety" wastes that signal.

## Related

- `chain-patterns/references/monitor-patterns.md` — streaming progress *during* a long run (complements completion notification).
- `ork:implement`, `ork:audit-full`, `ork:cover`, `ork:demo-producer` — skills that apply this rule.
