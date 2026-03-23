# CLI Reference

All emulate CLI commands and flags.

## Commands

### `emulate` (default)

Start emulate services.

```bash
# Start all services with defaults
npx emulate

# Specific services
npx emulate --service github
npx emulate --service github,vercel
npx emulate --service github,vercel,google

# With seed data
npx emulate --seed ./emulate.config.yaml
npx emulate --service github --seed .emulate/dev.yaml

# Custom port (overrides default for first service)
npx emulate --service github --port 5001

# Combine flags
npx emulate --service github,vercel --port 3000 --seed ./config.yaml
```

### `emulate init`

Generate a starter seed config.

```bash
# Generate config for GitHub
npx emulate init --service github

# Generate config for all services
npx emulate init

# Output to specific file
npx emulate init --service github > .emulate/github.yaml
```

### `emulate list`

List available services and their default ports.

```bash
npx emulate list
# github   :4001
# vercel   :4000
# google   :4002
```

## Flags

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--service` | `-s` | all | Comma-separated services: `github`, `vercel`, `google` |
| `--port` | `-p` | per-service | Override default port for the first listed service |
| `--seed` | | none | Path to YAML seed config file |
| `--help` | `-h` | | Show help |
| `--version` | `-v` | | Show version |

## Port Defaults

When no `--port` is specified:

| Service | Default Port |
|---------|-------------|
| Vercel | 4000 |
| GitHub | 4001 |
| Google | 4002 |

When `--port` is specified with multiple services, ports increment from the given base:

```bash
npx emulate --service github,vercel --port 3000
# github -> :3000
# vercel -> :3001
```

## Environment Variables

Set these in your test runner or CI to redirect API calls to the emulator:

| Variable | Example | SDK/Tool |
|----------|---------|----------|
| `GITHUB_API_BASE` | `http://localhost:4001` | Octokit, gh CLI |
| `VERCEL_API_BASE` | `http://localhost:4000` | Vercel SDK |
| `GOOGLE_OAUTH_BASE` | `http://localhost:4002` | Google Auth libraries |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Clean shutdown |
| 1 | Config parse error or port conflict |
| 130 | Interrupted (Ctrl+C) |
