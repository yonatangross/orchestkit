---
name: github-cli
description: Use when working with GitHub issues, pull requests, or Projects v2 via CLI. Covers gh commands for automation, PR creation, issue management, and workflow scripts.
version: 1.0.0
author: SkillForge AI Agent Hub
tags: [github, gh, cli, issues, pr, projects, automation, 2025]
---

# GitHub CLI Skill

## Overview

Master the GitHub CLI (`gh`) for comprehensive project management. This skill covers issue creation, PR workflows, Projects v2 integration, and automation patterns tailored for SkillForge's development workflow.

**When to use:**
- Creating/managing GitHub issues and PRs
- Working with GitHub Projects v2 custom fields
- Automating bulk operations with `gh`
- Following SkillForge's branch and PR conventions
- Running GraphQL queries for complex operations

---

## Quick Reference

### Essential Commands

```bash
# Issue operations
gh issue create --title "..." --body "..." --label "bug" --milestone "Sprint 1"
gh issue list --state open --label "backend" --assignee @me
gh issue edit 123 --add-label "high" --milestone "v2.0"

# PR operations
gh pr create --title "..." --body "..." --base dev --reviewer @teammate
gh pr checks 456 --watch              # Watch CI status
gh pr merge 456 --squash --delete-branch
gh pr merge 456 --auto --squash       # Auto-merge when approved

# Project operations
gh project list --owner @me
gh project item-add 1 --owner @me --url https://github.com/org/repo/issues/123

# API operations
gh api repos/:owner/:repo/issues --jq '.[].title'
gh api graphql -f query='...'
```

### JSON Output + jq Patterns

```bash
# Get issue numbers matching criteria
gh issue list --json number,labels --jq '[.[] | select(.labels[].name == "bug")] | .[].number'

# PR summary
gh pr list --json number,title,author --jq '.[] | "\(.number): \(.title) by \(.author.login)"'

# Count open PRs
gh pr list --json state --jq '[.[] | select(.state == "OPEN")] | length'
```

---

## SkillForge Workflow

### Branch Naming Convention

```bash
# For GitHub issues
issue/<number>-<brief-description>
# Examples:
issue/372-langfuse-migration
issue/385-langfuse-mcp-integration

# For features without issues
feature/<description>

# For bug fixes
fix/<description>
```

### Complete Feature Workflow

```bash
# 1. Create issue (if not exists)
ISSUE_URL=$(gh issue create \
  --title "feat: Add hybrid search with PGVector" \
  --body "$(cat <<'EOF'
## Description
Implement hybrid search combining BM25 and vector similarity.

## Acceptance Criteria
- [ ] HNSW index on chunks table
- [ ] RRF fusion algorithm
- [ ] Metadata boosting for section titles

## Technical Notes
See `.claude/skills/pgvector-search/SKILL.md`
EOF
)" \
  --label "enhancement,backend" \
  --milestone "Sprint 5: Library & Search" \
  --json url --jq '.url')

ISSUE_NUM=$(echo "$ISSUE_URL" | grep -o '[0-9]*$')

# 2. Create feature branch
git checkout dev && git pull origin dev
git checkout -b "issue/${ISSUE_NUM}-pgvector-hybrid-search"

# 3. Do work, commit with conventional commits
git add . && git commit -m "feat(#${ISSUE_NUM}): Implement hybrid search with RRF fusion"

# 4. Push and create PR
git push -u origin "issue/${ISSUE_NUM}-pgvector-hybrid-search"

gh pr create \
  --title "feat(#${ISSUE_NUM}): Implement hybrid search with PGVector" \
  --body "$(cat <<'EOF'
## Summary
- Added HNSW index to chunks table
- Implemented RRF fusion algorithm
- Added metadata boosting for section titles

## Test Plan
- [ ] Unit tests for search service
- [ ] Golden dataset ranking evaluation

Closes #${ISSUE_NUM}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)" \
  --base dev \
  --label "enhancement,backend"
```

### PR Commit Message Format

```bash
# Format: type(#issue): description
feat(#372): Implement Langfuse tracing integration
fix(#345): Resolve artifact page rendering bug
docs(#336): Update ROADMAP with multimodal milestone
refactor(#391): Split useAnalysisProgress hook
test(#342): Add 80% coverage for tutor feature
chore(#376): Upgrade December 2025 dependencies
```

### Project Board Integration

SkillForge uses GitHub Projects v2 with custom fields. After creating an issue:

```bash
# Add to project
ITEM_ID=$(gh project item-add 1 --owner yonatangross \
  --url "https://github.com/ArieGoldkin/SkillForge/issues/${ISSUE_NUM}" \
  --format json | jq -r '.id')

# Set Status to "In Development"
# See templates/skillforge-project-config.json for field IDs
```

> **Note:** Setting custom fields requires GraphQL. See `references/projects-v2.md`.

---

## Labels Reference

### Priority Labels
| Label | Description | Color |
|-------|-------------|-------|
| `🔥 critical` | Critical blocker | Red |
| `⚡ high` | High priority, sprint critical | Orange |
| `🔄 medium` | Medium priority | Yellow |
| `📋 low` | Low priority | Blue |

### Domain Labels
| Label | Description |
|-------|-------------|
| `🔵 backend` | Backend (Python, FastAPI, LangGraph) |
| `🟣 frontend` | Frontend (React, TypeScript) |
| `🤖 langgraph` | LangGraph workflows & agents |
| `🗄️ database` | Database schema, migrations, PGVector |
| `📡 sse` | SSE streaming & real-time |

### Type Labels
| Label | Description |
|-------|-------------|
| `✨ feature` | New features |
| `🐛 bug` | Bug fixes |
| `🔄 refactor` | Code improvements |
| `📝 documentation` | Documentation updates |
| `🧪 evaluation` | Evaluation framework & testing |

---

## Milestones Reference

Current active milestones:

| Milestone | Due Date | Focus |
|-----------|----------|-------|
| 🟤 Triple-Consumer Artifacts | Dec 25, 2025 | Schema enhancement |
| 🔄 Langfuse Migration | Jan 7, 2026 | Observability |
| 🟡 Tutoring System | Feb 5, 2026 | Socratic tutoring |
| 🔵 Staging/Production | Feb 26, 2026 | Deployment |
| 🌈 Multimodal Intelligence | May 7, 2026 | Vision analysis |

---

## Detailed Guides

For specific capabilities, see:

- **Issue Management**: `references/issue-management.md`
  - Bulk operations, templates, parent/sub-issues

- **PR Workflows**: `references/pr-workflows.md`
  - Review workflow, merge strategies, auto-merge

- **Projects v2**: `references/projects-v2.md`
  - Custom fields, GraphQL mutations, SkillForge field IDs

- **GraphQL API**: `references/graphql-api.md`
  - Complex queries, pagination, bulk operations

- **Automation Patterns**: `references/automation-patterns.md`
  - Aliases, error handling, rate limits, scripts

---

## Best Practices

1. **Always use `--json` for scripting** - Parse with `--jq` for reliability
2. **Non-interactive mode for automation** - Use `--title`, `--body` flags
3. **Check rate limits before bulk operations** - `gh api rate_limit`
4. **Use heredocs for multi-line content** - `--body "$(cat <<'EOF'...EOF)"`
5. **Link issues in PRs** - `Closes #123`, `Fixes #456`
6. **Add verification checklists** - Track test plan completion
7. **Never commit to dev/main directly** - Always use feature branches + PRs

## Capability Details

### issue-management
**Keywords:** gh issue, create issue, issue labels, milestone, assignee, bulk issues
**Solves:**
- How do I create a GitHub issue?
- Add labels to multiple issues
- Link issue to milestone
- Create issue from template

### pr-workflows
**Keywords:** gh pr, pull request, create PR, review PR, merge, auto-merge, pr checks
**Solves:**
- How do I create a PR with gh?
- Wait for PR checks to pass
- Auto-merge when approved
- Request PR review

### projects-v2
**Keywords:** gh project, project board, custom fields, Status, Priority, Sprint, project views
**Solves:**
- How do I add issue to project board?
- Set project Status field
- Move item to In Progress
- Query project items

### graphql-api
**Keywords:** gh api graphql, GraphQL query, custom query, bulk operations, pagination
**Solves:**
- How do I run GraphQL queries with gh?
- Get all open issues with custom fields
- Bulk update project items
- Complex GitHub API queries

### automation-patterns
**Keywords:** gh automation, gh alias, bulk operations, jq, scripting, retry, rate limit
**Solves:**
- Create reusable gh aliases
- Handle rate limits in scripts
- Bulk close stale issues
- Automated workflow scripts

### skillforge-workflow
**Keywords:** SkillForge, feature branch, conventional commits, PR template, dev branch
**Solves:**
- SkillForge branch naming convention
- Create issue and feature branch
- SkillForge PR workflow
- Project field IDs for SkillForge
