# Fix Complete Checklist

Verify all aspects of issue resolution before closing.

## Root Cause Analysis

- [ ] Root cause identified with confidence >= 70%
- [ ] Hypotheses documented (at least 2 considered)
- [ ] Evidence for/against documented
- [ ] Similar issues checked

## Fix Verification

- [ ] Regression test added
- [ ] All existing tests pass
- [ ] Fix manually verified
- [ ] Edge cases covered

## Prevention

- [ ] Prevention recommendation documented
- [ ] At least one prevention measure implemented or ticketed
- [ ] Runbook entry created/updated

## Knowledge Capture

- [ ] Lessons learned stored in memory
- [ ] RCA report generated (for high/critical issues)
- [ ] Related issues linked

## PR/Commit

- [ ] Commit message includes issue number
- [ ] Commit message describes root cause
- [ ] PR links to issue with "Fixes #N"

## Final Verification

```bash
# Quick verification commands
git log -1 --oneline  # Check commit message
gh pr checks          # Check CI status
gh issue view [N]     # Verify issue linked
```
