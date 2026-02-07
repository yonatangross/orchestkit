# CC 2.1.30+ Enhancements

## Task Metrics

Task tool results now include `token_count`, `tool_uses`, and `duration_ms`. Use for scope monitoring:

```markdown
## Phase 5 Metrics (Implementation)
| Agent | Tokens | Tools | Duration |
|-------|--------|-------|----------|
| backend-system-architect #1 | 680 | 15 | 25s |
| backend-system-architect #2 | 540 | 12 | 20s |
| frontend-ui-developer #1 | 720 | 18 | 30s |

**Scope Check:** If token_count > 80% of budget, flag scope creep
```

## Tool Usage Guidance (CC 2.1.31)

Use the right tools for each operation:

| Task | Use | Avoid |
|------|-----|-------|
| Find files by pattern | `Glob("**/*.ts")` | `bash find` |
| Search code | `Grep(pattern="...", glob="*.ts")` | `bash grep` |
| Read specific file | `Read(file_path="/abs/path")` | `bash cat` |
| Edit/modify code | `Edit(file_path=...)` | `bash sed/awk` |
| Parse file contents | `Read` with limit/offset | `bash head/tail` |
| Git operations | `Bash git ...` | (git needs bash) |
| Run tests/build | `Bash npm/poetry ...` | (CLIs need bash) |

## Session Resume Hints (CC 2.1.31)

Before ending implementation sessions, capture context:

```bash
/ork:remember Implementation of {feature}:
  Completed: phases 1-6
  Remaining: verification, docs
  Key decisions: [list]
  Blockers: [if any]
```

Resume later with full context preserved.
