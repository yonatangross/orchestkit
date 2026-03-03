# Bug Report Reference

Workflow for `/ork:feedback bug` — filing GitHub issues with auto-collected context.

## Flow

### Step 1: Gather Description

If no description argument provided, use AskUserQuestion:

```python
AskUserQuestion(questions=[
  {
    "question": "What went wrong?",
    "header": "Bug Description",
    "options": [
      {"label": "Skill issue", "description": "A skill (/ork:*) didn't work as expected"},
      {"label": "Agent issue", "description": "A spawned agent produced wrong results or failed"},
      {"label": "Hook issue", "description": "A hook blocked something it shouldn't, or missed something"},
      {"label": "Build/install issue", "description": "Plugin build, installation, or setup problem"},
      {"label": "Other", "description": "Something else went wrong"}
    ],
    "multiSelect": false
  }
])
```

Then ask the user to describe the issue in their own words if they haven't already.

### Step 2: Collect Environment Context (automatic)

Read these files — never prompt the user for info that's already available:

```python
# Version from package.json
Read(file_path="{project_dir}/package.json")  # extract "version" field

# OS info
Bash(command="uname -s -r")

# Claude Code version (if available)
Bash(command="claude --version 2>/dev/null || echo 'unknown'")

# Git branch
Bash(command="git branch --show-current 2>/dev/null || echo 'unknown'")
```

From `.claude/feedback/metrics.json` (if exists):
- Last skill used and its success rate
- Last agent spawned and its success rate

### Step 3: Check for Duplicates

Before creating, search existing issues:

```bash
gh issue list -R yonatangross/orchestkit \
  --search "{keywords from description}" \
  --state open \
  --json number,title,url \
  --limit 5
```

If potential duplicates found, show them to the user:
- "Found N similar open issues. Is yours one of these?"
- If yes, comment on the existing issue instead of creating a new one
- If no, proceed to create

### Step 4: PII Sanitization

Before including any auto-collected context, strip:
- Absolute paths containing `/Users/` or `/home/` — replace with `~`
- Email addresses
- URLs with tokens or API keys
- Anything matching `password`, `secret`, `token`, `key` in values
- Git remote URLs (may contain tokens)

### Step 5: Create the Issue

```bash
gh issue create -R yonatangross/orchestkit \
  --title "Bug: {concise_title}" \
  --label "bug" \
  --body "$(cat <<'EOF'
## Bug Report

**Description:** {user_description}

**Category:** {skill|agent|hook|build|other}

## Steps to Reproduce

{user_provided_steps_or "1. [Please describe steps to reproduce]"}

## Expected Behavior

{user_provided_or "N/A"}

## Actual Behavior

{user_description_of_what_happened}

## Environment

| Field | Value |
|-------|-------|
| OrchestKit | {version} |
| Claude Code | {cc_version} |
| OS | {os_info} |
| Branch | {branch} |

## Context

{if metrics available:}
- Last skill: `{skill_name}` ({success_rate}% success rate)
- Last agent: `{agent_name}` ({success_rate}% success rate)

---
*Filed via `/ork:feedback bug`*
EOF
)"
```

### Step 6: Confirm to User

Show the created issue URL and number:

```
Bug report filed!

  Issue: #123
  URL:   https://github.com/yonatangross/orchestkit/issues/123
  Title: Bug: {title}

Track progress or add details at the URL above.
```

## Fallback: gh Not Authenticated

If `gh auth status` fails:

1. Write issue body to `.claude/feedback/pending-bugs/bug-{timestamp}.md`
2. Tell the user:

```
Could not create GitHub issue (gh CLI not authenticated).

Bug report saved to:
  .claude/feedback/pending-bugs/bug-20260226-143000.md

To file manually:
  1. Run: gh auth login
  2. Then: gh issue create -R yonatangross/orchestkit --body-file .claude/feedback/pending-bugs/bug-20260226-143000.md --title "Bug: {title}" --label bug
```

## Privacy Rules

- NEVER include file contents, code snippets, or conversation history in the issue
- ONLY include: version numbers, OS type, skill/agent names, success rates
- All paths sanitized to relative or `~`
- User reviews the issue body before submission (show it, ask "Create this issue?")
