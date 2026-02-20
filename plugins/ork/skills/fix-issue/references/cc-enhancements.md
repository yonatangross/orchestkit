# CC 2.1.27+ Enhancements for Fix Issue

## Session Resume with PR Context

When you create a PR for the fix, the session is automatically linked:

```bash
# Later: Resume with full PR context
claude --from-pr 789
```

## Task Metrics (CC 2.1.30)

Track RCA efficiency across the 5 parallel agents:

```markdown
## Phase 4 Metrics (Root Cause Analysis)
| Agent | Tokens | Tools | Duration |
|-------|--------|-------|----------|
| debug-investigator #1 | 520 | 12 | 18s |
| debug-investigator #2 | 480 | 10 | 15s |
| backend-system-architect | 390 | 8 | 12s |

**Root cause found in:** 45s total
```

## Tool Guidance (CC 2.1.31)

When investigating root cause:

| Task | Use | Avoid |
|------|-----|-------|
| Read logs/files | `Read(file_path=...)` | `bash cat` |
| Search for errors | `Grep(pattern="ERROR")` | `bash grep` |
| Find affected files | `Glob(pattern="**/*.py")` | `bash find` |
| Check git history | `Bash git log/diff` | (git needs bash) |

## Session Resume Hints (CC 2.1.31)

Before ending fix sessions, capture investigation context:

```bash
/ork:remember Issue #$ARGUMENTS RCA findings:
  Root cause: [one line]
  Confirmed by: [key evidence]
  Fix status: [implemented/pending]
  Prevention: [recommendation]
```

Resume later:
```bash
claude                              # Shows resume hint
/ork:memory search "issue $ARGUMENTS"  # Loads your findings
```
