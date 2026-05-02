# Changelog

## 2.1.127

- Added `claude project list` command to enumerate all known projects with their canonical paths and last-touched timestamps
- New `claude_code.session_resume` OpenTelemetry event fires when `--resume` rehydrates a session, with `previous_session_id` and `gap_seconds` attributes
- `--dangerously-skip-permissions` now also bypasses prompts for writes to `.husky/`, `.gitlab/`, `Pipfile`, and `pyproject.toml`
- Fixed `Ctrl+R` reverse-search resetting the prompt when no match found
- Fixed Japanese IME composition breaking on macOS Sequoia
- Windows: PowerShell 7.4 is now detected when installed via Scoop

## 2.1.126

- The `/model` picker now lists models from your gateway's `/v1/models` endpoint when `ANTHROPIC_BASE_URL` points at an Anthropic-compatible gateway
- Added `claude project purge [path]` to delete all Claude Code state for a project (transcripts, tasks, file history, config entry) — supports `--dry-run`, `-y/--yes`, `-i/--interactive`, and `--all`
- `--dangerously-skip-permissions` now bypasses prompts for writes to `.claude/`, `.git/`, `.vscode/`, shell config files, and other previously-protected paths (catastrophic removal commands still prompt as a safety net)
- `claude_code.skill_activated` OpenTelemetry event now fires for user-typed slash commands and carries a new `invocation_trigger` attribute (`"user-slash"`, `"claude-proactive"`, or `"nested-skill"`)
