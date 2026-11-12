---
description: "Serves a static HTML page at a stable https://NAME.localhost/ URL via portless, never a port, and stops it on request. Use when an agent made a page a person should open. Not for app dev servers (use dev)."
argument-hint: "[path] [--name slug] [--screenshot|--no-screenshot] | stop [name|--all] | status [--json]"
disable-model-invocation: false
context: inherit
user-invocable: true
name: page-serve
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

## Before running a script from this command (Cursor)

Cursor does not tell a command where this plugin is installed. Run plugin scripts only from the installed plugin directory, never by a relative `skills/...` or `hooks/...` path.

Find the installed plugin directory first:

```bash
(
  ork_ws="$(pwd -P)"
  ork_base="$(cd "$HOME/.cursor/plugins" 2>/dev/null && pwd -P)"
  ork_above=""
  case "$ork_base/" in "$ork_ws"/*) ork_above=1 ;; esac
  ork_real=""
  if [ -n "$ork_base" ]; then
    ork_real="$(find "$ork_base" -maxdepth 6 -type f -path '*/.cursor-plugin/plugin.json' 2>/dev/null | sort | while IFS= read -r ork_pj; do
      ork_r="$(cd "${ork_pj%/.cursor-plugin/plugin.json}" && pwd -P)" || continue
      case "$ork_r/" in "$ork_base"/*) ;; *) continue ;; esac
      if [ -z "$ork_above" ]; then case "$ork_r/" in "$ork_ws"/*) continue ;; esac; fi
      case "$ork_ws/" in "$ork_r"/*) continue ;; esac
      grep -Eq '"name"[[:space:]]*:[[:space:]]*"ork"' "$ork_pj" || continue
      [ -d "$ork_r/skills/page-serve" ] || continue
      printf '%s\n' "$ork_r"
      break
    done)"
  fi
  [ -n "$ork_real" ] || { echo "REFUSED: no installed OrchestKit plugin with this skill under ~/.cursor/plugins"; exit 3; }
  echo "ORK_PLUGIN_DIR=$ork_real"
)
```

Run a script only when this prints `ORK_PLUGIN_DIR=<dir>`, and use that `<dir>` in place of `<ORK_PLUGIN_DIR>` below. If it prints `REFUSED: ...`, stop and tell the user the reason.

# Auto-generated from skills/page-serve/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# page-serve, give a human a URL

An agent that renders a page for a human needs a way to hand it over. The pattern
that grew in sessions was `python3 -m http.server 8991` plus `portless alias <name> 8991`
typed by hand: no record of the process, no stop, servers outliving the session,
and one measured night (2026-09-06) where the same session did it twice and the
server was still up the next morning. This skill is that pattern with a state file,
a stop, a status, and a loud failure when the URL contract cannot be met.

## The contract

- The URL is `https://<name>.localhost/<file>`. No port, ever. portless's 443 service
  owns the port; a `:1355` or `:8991` in the URL is the pre-service fallback and the
  skill refuses rather than emit one.
- One static server per name, on a free loopback port, rooted at the file's
  directory (so sibling assets resolve) or at the directory you pass.
- State in `.claude/state/page-serve/<name>.json`: root, file, port, pid, url, time.
  `status` re-measures pid, route, and HTTP on every call; it never trusts the file.
- Idempotent per name: same name + same root reuses the live server; a different root
  replaces it; `--force` on the alias overrides a stale route with the same name.

## Usage

The skill is three scripts in its own folder. Run them by path:

```bash
bash "<ORK_PLUGIN_DIR>/skills/page-serve/scripts/serve.sh" ./report.html
bash "<ORK_PLUGIN_DIR>/skills/page-serve/scripts/serve.sh" ./pages/ --name pages
bash "<ORK_PLUGIN_DIR>/skills/page-serve/scripts/serve.sh" <path> --screenshot   # agent-browser, returns the png path
bash "<ORK_PLUGIN_DIR>/skills/page-serve/scripts/status.sh" [--json]
bash "<ORK_PLUGIN_DIR>/skills/page-serve/scripts/stop.sh" <name>
bash "<ORK_PLUGIN_DIR>/skills/page-serve/scripts/stop.sh" --all
```

`serve.sh` prints `url=`, `name=`, `port=`, `pid=`, `http=`, optional `screenshot=`,
and the exact `stop=` line to paste. Put the `url=` line in your reply's Open section.

## Modes

| Invocation | Script | What happens |
|---|---|---|
| `<path> [flags]` | `<ORK_PLUGIN_DIR>/skills/page-serve/scripts/serve.sh` | prerequisites, server, alias, state, curl check, optional screenshot |
| `status [--json]` | `<ORK_PLUGIN_DIR>/skills/page-serve/scripts/status.sh` | one line per served page: server up/dead, route registered/missing, HTTP code |
| `stop <name>` or `stop --all` | `<ORK_PLUGIN_DIR>/skills/page-serve/scripts/stop.sh` | alias removed, server killed, state and screenshot deleted; every step reports |

## Failure modes, all loud

| Condition | Exit | What it says |
|---|---|---|
| portless not installed | 2 | install line, then `portless service install` |
| 443 service not responding | 2 | `portless service status`, the operator's `launchctl kickstart` line, and "do not fall back to a :port URL" |
| server did not bind | 3 | port and log path |
| alias registration failed | 2 | portless's own message, server cleaned up |
| route up but URL not 200 | 4 | code, curl rc, and `portless list`; server left running for inspection |
| screenshot failed | 0 | reported on stderr, page still served, `screenshot=` line omitted |

A page that "served" but does not answer 200 through the proxy is exit 4, not 0, so a
caller that only reads the exit code cannot report a dead link as done.

## Screenshot

With agent-browser installed the default is to take one (`--no-screenshot` to skip;
`--screenshot` to insist and get a stderr line if it is missing). The png lands
beside the state file. The screenshot is evidence the page rendered, not proof it
rendered correctly: read the image before claiming the page looks right
(the glyph skill's rule 1).

## What this is not

- Not a dev server. For a framework app with hot reload use `dev`, which wraps
  the app's own dev command in portless. This skill serves static files.
- Not a publisher. Nothing leaves the machine; `.localhost` resolves locally only.
- Not a docs-site deploy. Lab pages under `docs/site/public/lab/` still ship through
  the docs-site build; this skill is for the hand-over before or beside that.

## Retiring the old pattern (#3900)

Any skill or page that tells an agent to run `python3 -m http.server` or to type
`portless alias` by hand should use this skill instead. The skills that hand a
human a page (glyph, visualize-plan, expect) are the ones to keep pointed here.

## Related skills

- `dev`, the dev-loop sibling for framework apps (portless wrapping a dev command)
- `portless` (the reference skill, model-invoked): service install, LAN mode, gotchas
- `glyph`, `visualize-plan`, and the separate `playground` plugin, the producers of pages this serves
- `expect`, browser verification against the URL this prints
