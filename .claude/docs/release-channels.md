# Claude Code Release Channels

**Version:** 1.0.0
**Requires:** Claude Code >= 2.1.6

## Overview

Claude Code 2.1.3 introduced a release channel toggle allowing users to switch between stable and latest releases. This document explains how OrchestKit works with each channel.

## Channel Options

### Stable (Recommended)

```
/config → Release Channel → stable
```

**Use for:**
- Production workflows
- Team environments
- When stability is critical

**OrchestKit compatibility:**
- All features fully tested
- Hook timeouts behave as documented
- Permission rules validated

### Latest

```
/config → Release Channel → latest
```

**Use for:**
- Testing new CC features early
- Development environments
- Feature experimentation

**OrchestKit compatibility:**
- May have untested edge cases
- New features available sooner
- Report issues if found

## Checking Your Channel

```bash
# Check current Claude Code version
claude --version

# Expected: Claude Code v2.1.4 or higher
```

## OrchestKit Channel Requirements

| OrchestKit Version | Min CC Version | Recommended Channel |
|-------------------|----------------|---------------------|
| 4.7.0+ | 2.1.4 | stable |
| 4.6.x | 2.1.2 | stable |
| 4.5.x | 2.0.0 | stable |

## Features by CC Version

### CC 2.1.3 Features Used by OrchestKit

1. **10-Minute Hook Timeout**
   - Quality gate hooks can run full test suites
   - Security scans aggregate multiple tools
   - LLM code review has time to complete

2. **Unreachable Permission Rules Detection**
   - `/ork:doctor` validates permission configurations
   - Warns about rules that can never match

3. **Fixed Sub-Agent Model Selection**
   - Agent model preferences work correctly
   - workflow-architect uses opus as intended

4. **Merged Commands/Skills**
   - Unified namespace for all invocations
   - Commands work as skills with progressive loading

## Switching Channels

```bash
# Open Claude Code config
/config

# Navigate to Release Channel
# Select: stable OR latest

# Restart Claude Code for changes to take effect
```

## Troubleshooting

### "Feature not available"

If you see this error, your CC version may be too old:

```bash
# Check version
claude --version

# Update Claude Code
# (Method depends on your installation)
```

### Hooks timing out

If hooks that worked before start timing out:

1. Check if you switched to an older CC version
2. Verify timeout is set to 600000 (10 minutes) in settings.json
3. Run `/ork:doctor` to validate hook configuration

## References

- [Claude Code Changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
- [OrchestKit CHANGELOG](../../CHANGELOG.md)