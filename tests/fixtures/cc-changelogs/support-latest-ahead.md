# Changelog

## 2.1.135

- Latest entry — already snapshotted in this scenario; the fixture's role is to assert the watcher detects the older missing-on-disk versions even when the floor (cc-support.json.latest) is ahead of them
- Adds `claude session diff` to compare two saved sessions

## 2.1.134

- Missing-on-disk version older than knownLatest=2.1.135; W1b filter must include this even though `cmp < 0`
- New `--budget-seconds` flag on `claude -p` to cap wall time

## 2.1.133

- Also missing-on-disk; same scenario as 2.1.134
- `EnterWorktree` accepts `--from-tag` to base the new branch on a tag rather than HEAD

## 2.1.132

- Already snapshotted — must NOT be re-included
- Reference floor entry; preserves test alignment with shared/cc-support.json
