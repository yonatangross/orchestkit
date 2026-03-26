---
name: RTK Tool Reference
description: RTK (Rust Token Killer) — Claude Code CLI proxy that reduces LLM token consumption 60-90% via PreToolUse hook. Latest version, install steps, hook config, best practices.
type: reference
---

## What RTK Is

RTK = **Rust Token Killer**. A single Rust binary CLI proxy that compresses shell command output before it reaches Claude Code's context window, achieving 60-90% token reduction on common dev commands.

- GitHub: https://github.com/rtk-ai/rtk
- Website: https://www.rtk-ai.app/
- License: MIT (free and open-source)
- Language: Rust — <10ms startup, <5MB binary, zero runtime dependencies

**Name collision warning**: Two projects share the name "rtk" — this is `rtk-ai/rtk` (Rust Token Killer), NOT `reachingforthejack/rtk` (Rust Type Kit). Verify with `rtk gain` — only Token Killer responds to that command.

## Latest Version (as of 2026-03-25)

**v0.33.1** (released 2026-03-25). Actively maintained; repo updated March 25, 2026.

## How It Works

1. Claude Code decides to run a shell command (e.g., `git status`)
2. PreToolUse hook in `~/.claude/settings.json` intercepts the call
3. Hook rewrites command to `rtk git status` transparently
4. RTK runs the command, filters/compresses output
5. Compact output returned to Claude — Claude never sees the rewrite

Supports 30+ commands: git, cargo, npm, pytest, go test, docker, kubectl, grep, ls, rspec, rubocop, rake, and more.

## Installation

```bash
# Homebrew (recommended)
brew install rtk

# Or curl installer
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh | sh

# Or cargo
cargo install --git https://github.com/rtk-ai/rtk

# Verify correct version installed
rtk gain
```

## Claude Code Integration (Hook Setup)

```bash
# Global hook — recommended, covers all projects and subagents
rtk init -g

# What it creates:
# - ~/.claude/hooks/rtk-rewrite.sh
# - ~/.claude/RTK.md (~10 tokens of context)
# - Updates ~/.claude/CLAUDE.md with @RTK.md reference
# - Patches ~/.claude/settings.json (with backup to .bak)

# Non-interactive (CI/CD)
rtk init -g --auto-patch

# Hook only, no CLAUDE.md context overhead
rtk init -g --hook-only

# Verify installation
rtk init --show

# Uninstall
rtk init -g --uninstall
```

Restart Claude Code after installation for the hook to take effect.

## Configuration

Config file: `~/.config/rtk/config.toml`
Environment variables take precedence over config file.

Key monitoring commands:
- `rtk gain` — view token savings stats
- `rtk gain --graph` — visual savings over time
- `rtk discover` — identify underutilized compression opportunities

## Token Savings (Real-World)

- `vitest run`: 99.6% reduction
- `cargo test`: 155 lines → 3 lines (98%)
- `pnpm outdated`: 80-90%
- `git status`: 59-76%
- Typical 30-min session: 150K → 45K tokens (~70%)
- Best reported: 10.3M tokens saved over 2,927 commands (89.2%)

## Recent Changes (v0.33.x)

- Ruby on Rails support: rspec, rubocop, rake, bundle (60-90% reduction)
- GoLangCI-lint v2 compatibility
- Git status symbols (*, +, ~, ?) replaced with plain text labels (BREAKING for output parsers)
- `rails test` preferred over `rake test` for positional file args
- Hook security: respects Claude Code permission rules
- Stderr redirect handling in command rewriting
- Cargo test compile diagnostic preservation

## OrchestKit / Hook Interaction

RTK uses a **PreToolUse** hook registered in `~/.claude/settings.json`. This is the same hook system OrchestKit uses. They can coexist but:
- Ensure hook order in settings.json doesn't create conflicts
- RTK rewrites happen before OrchestKit hooks see the command output
- RTK's `--hook-only` mode minimizes context overhead if OrchestKit already manages CLAUDE.md

## Complementary Tools

RTK + Serena MCP stack covers different surfaces with no overlap:
- Serena: code navigation via LSP (file reads, symbol lookups)
- RTK: shell command output compression
- Combined: 90%+ token savings achievable

**Why:** RTK covers different surfaces
**How to apply:** When recommending token optimization, suggest RTK for shell output + Serena MCP for code navigation as a complementary pair.
