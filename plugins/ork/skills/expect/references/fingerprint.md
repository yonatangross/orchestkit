# Fingerprint Gating

SHA-256 fingerprint system to skip redundant test runs when files haven't changed.

## How It Works

```
Changed files → SHA-256 each → Compare against .expect/fingerprints.json → Skip or Run
```

## Fingerprint Storage

```json
// .expect/fingerprints.json
{
  "lastRun": "2026-03-26T16:30:00Z",
  "target": "unstaged",
  "hashes": {
    "src/components/Button.tsx": "a1b2c3d4...",
    "src/app/login/page.tsx": "e5f6g7h8..."
  },
  "result": "pass"
}
```

## Computing Fingerprints

```bash
# Hash each changed file
sha256sum $(git diff --name-only) | sort
```

## Decision Logic

```python
def should_run(current_hashes: dict, stored: dict) -> bool:
    if not stored:
        return True  # First run — no fingerprints
    if current_hashes != stored["hashes"]:
        return True  # Files changed since last run
    if stored["result"] == "fail":
        return True  # Last run failed — re-run even if unchanged
    return False     # Same hashes, last run passed — skip
```

## Force Re-Run

Use `--force` flag to bypass fingerprint check:
```bash
/ork:expect --force  # Re-run even if fingerprints match
```

## Implementation Notes

- Hash file **contents**, not metadata (mtime changes shouldn't trigger re-runs)
- Store fingerprints per target (unstaged vs branch vs commit)
- Clear fingerprints on `git checkout` or `git stash` (contents changed)
- `.expect/fingerprints.json` should be gitignored
