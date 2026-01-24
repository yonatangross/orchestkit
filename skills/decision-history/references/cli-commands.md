# CLI Commands Reference

Detailed command reference for the decision-history CLI tool.

## Installation

The CLI is built into the OrchestKit hooks infrastructure:

```bash
# From project root
node hooks/bin/decision-history.mjs <command> [options]

# Or add alias to your shell
alias decision-history='node /path/to/orchestkit/hooks/bin/decision-history.mjs'
```

## Commands

### `list`

List all decisions with filtering options.

```bash
decision-history list [OPTIONS]

Options:
  --cc-version TEXT     Filter by Claude Code version (e.g., 2.1.16)
  --category TEXT       Filter by category (security, api, architecture...)
  --impact TEXT         Filter by impact level (high, medium, low)
  --source TEXT         Filter by source (changelog, session, coordination)
  --days INT            Show only last N days
  --limit INT           Maximum decisions to show (default: 20)
```

**Examples:**

```bash
# List recent decisions
decision-history list

# All high-impact decisions
decision-history list --impact high

# Security decisions from last 30 days
decision-history list --category security --days 30

# Decisions for CC 2.1.16
decision-history list --cc-version 2.1.16

# Limit output
decision-history list --limit 10
```

### `show`

Show detailed information about a specific decision.

```bash
decision-history show <DECISION_ID>
```

**Examples:**

```bash
# Show decision details
decision-history show 4.28.0-architecture-1

# Partial ID matching works
decision-history show 4.28.0-security
```

### `search`

Search decisions by text across summary, rationale, and category.

```bash
decision-history search <QUERY>
```

**Examples:**

```bash
# Search for hook-related decisions
decision-history search "hook"

# Search for security topics
decision-history search "authentication"
```

### `timeline`

Display an ASCII timeline visualization grouped by CC version, category, or month.

```bash
decision-history timeline [OPTIONS]

Options:
  --group-by TEXT       Group by: cc_version, category, month (default: cc_version)
  --days INT            Show only last N days
```

**Examples:**

```bash
# Timeline by CC version (default)
decision-history timeline

# Timeline by category
decision-history timeline --group-by category

# Timeline by month
decision-history timeline --group-by month

# Last 90 days only
decision-history timeline --days 90
```

### `stats`

Show statistics summary with counts by category, impact, CC version, and source.

```bash
decision-history stats
```

**Output includes:**
- Total decisions count
- Decisions by source (changelog, session, coordination)
- Impact distribution (high/medium/low)
- Top 10 categories
- CC version distribution

### `mermaid`

Generate Mermaid timeline diagram for documentation.

```bash
decision-history mermaid [OPTIONS]

Options:
  --output FILE         Write to file instead of stdout
  --group-by TEXT       Group by: cc_version, category (default: cc_version)
  --full                Generate full document with multiple diagrams
```

**Examples:**

```bash
# Output to terminal
decision-history mermaid

# Save to file
decision-history mermaid --output docs/timeline.md

# Full document with multiple diagrams
decision-history mermaid --full --output docs/decision-history.md

# Group by category
decision-history mermaid --group-by category
```

### `sync`

Refresh the decision cache from all sources.

```bash
decision-history sync
```

This command:
1. Re-parses CHANGELOG.md
2. Loads session decisions from `.claude/context/knowledge/decisions/active.json`
3. Loads coordination decisions from `.claude/coordination/decision-log.json`
4. Updates the cache at `.claude/feedback/changelog-decisions.json`

## Data Sources

Decisions are aggregated from these sources (priority order):

| Source | Location | Priority |
|--------|----------|----------|
| Session | `.claude/context/knowledge/decisions/active.json` | Highest |
| CHANGELOG | `CHANGELOG.md` | Medium |
| Coordination | `.claude/coordination/decision-log.json` | Lowest |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (invalid arguments, module not found, etc.) |

## Troubleshooting

### Module not found error

```bash
# Rebuild the hooks bundle
cd hooks && npm run build
```

### No decisions found

```bash
# Force sync from sources
decision-history sync
```

### CC version showing as "?"

This occurs when CHANGELOG entries don't explicitly mention a CC version.
The CC version is detected from text patterns like "CC 2.1.16" or "CC 2.1.x".
