# Audit Report Structure

## Report Format

```markdown
# Audit Report: {project-name}
**Date:** {date} | **Mode:** {mode} | **Files loaded:** {count} | **LOC:** {loc}

## Executive Summary
{1-3 sentences: overall health, critical findings count}

## Findings

| # | Severity | Category | File(s) | Finding | Remediation |
|---|----------|----------|---------|---------|-------------|
| 1 | CRITICAL | Security | src/auth.ts:42 | ... | ... |

## Severity Breakdown
- CRITICAL: {n} (must fix before deploy)
- HIGH: {n} (fix within sprint)
- MEDIUM: {n} (fix within quarter)
- LOW: {n} (track and address)

## Architecture Diagram
{ASCII diagram of module dependencies}

## Recommendations
{Prioritized action items}
```

## Severity Classification

| Level | Criteria | Timeline |
|-------|----------|----------|
| CRITICAL | Exploitable vulnerability, data loss risk, auth bypass | Must fix before deploy |
| HIGH | Security weakness, major arch violation, EOL dependency | Fix within sprint |
| MEDIUM | Code smell, minor arch inconsistency, stale dependency | Fix within quarter |
| LOW | Style issue, minor improvement, documentation gap | Track and address |

## Codebase Loading Strategy

1. **Glob all source files** matching inclusion patterns
2. **Sort by priority**: entry points -> core modules -> utilities -> config
3. **Read files in parallel** using multiple Read tool calls per message
4. **Track loaded tokens** to stay within budget

### Inclusion Patterns (by language)

```bash
# TypeScript/JavaScript
**/*.ts **/*.tsx **/*.js **/*.jsx
**/package.json **/tsconfig.json

# Python
**/*.py
**/pyproject.toml **/setup.cfg **/requirements*.txt

# Config
**/.env.example **/docker-compose*.yml **/Dockerfile
**/*.yaml **/*.yml (non-lock)
```

### Reading Pattern

Read files in batches of 10-15 per message for efficiency:

```python
# Batch 1: Entry points and config
Read("src/index.ts")
Read("src/app.ts")
Read("package.json")
Read("tsconfig.json")
# ... up to 15 files

# Batch 2: Core modules
Read("src/api/routes.ts")
Read("src/db/connection.ts")
# ... next batch
```
