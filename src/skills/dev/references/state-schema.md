# `.claude/state/dev-stack.json` schema

Written atomically by `scripts/boot.sh`. Read by `scripts/status.sh`, `scripts/stop.sh`, and the `posttool/ui-change-detector` hook (for `baseUrl` injection into the auto-expect nudge).

## Shape

```typescript
interface DevStackState {
  bootedAt: string;              // ISO 8601
  branch: string;                // git branch at boot time
  subdomain: string;             // e.g. "feat-m125-lane-b.localhost"
  baseUrl: string;               // canonical URL from `portless get <slug>` —
                                 // includes the proxy's actual port if non-default
                                 // (e.g. "https://feat-m125-lane-b.localhost:1355")

  processes: {
    portlessWrapper: {           // ALWAYS present after a successful boot.
      pid: number;               // The PID of `portless <slug> <pkg-mgr> run dev`.
                                 // Killing this PID + its descendants tears down
                                 // the entire wrapped dev server (see stop.sh).
      command: string;           // For diagnostic display only.
    };

    agentBrowser: {              // ALWAYS present.
      sessionName: string;       // == subdomain slug. Used as AGENT_BROWSER_SESSION env
                                 // value or `--session <name>` flag. Sessions are lazy —
                                 // no daemon PID to track.
    };

    emulate?: {                  // OPTIONAL — only present if emulate.config.yaml exists.
      pid: number;               // The PID of `emulate --seed <yaml>`.
      command: string;
    };
  };

  emulators: string[];           // Top-level service keys parsed from emulate.config.yaml
                                 // by awk. Empty array if no config or empty services map.
                                 // Example: ["github", "stripe", "google-oauth"]

  notes: string;                 // Free-form context. Currently used to remind readers
                                 // that the portless proxy daemon is shared and not
                                 // tracked in this file.
}
```

## What the file does NOT contain

- **The portless proxy daemon's PID** — it's a shared, long-lived service. boot.sh only ensures it's running; stop.sh deliberately leaves it alone.
- **The dev server's child PID** — it's a child of `portlessWrapper`, discovered at teardown via `pgrep -P`.
- **The agent-browser browser process PID** — sessions are lazy, no daemon.

## Liveness contract

A "live" stack has the `portlessWrapper.pid` responding to `process.kill(pid, 0)`. If that PID is dead, the route is unregistered and the wrapped dev server is gone — even if the state file still exists. `status.sh --quiet` returns exit 0 only when at least one tracked PID (wrapper or emulate) is alive.

## Reader contract

External consumers (other hooks, skills, the user via `cat`) MUST treat the file as read-only and tolerate it not existing. Writers go through `scripts/boot.sh` and `scripts/stop.sh`.

The hook `posttool/ui-change-detector` reads `baseUrl` to inject the dev URL into the auto-expect nudge — if the file is missing or malformed, the hook silently skips (graceful no-op).

## Worktree isolation

Each git worktree has its own `.claude/state/` directory and its own dev-stack.json. Two worktrees with branches `feat/foo` and `feat/bar` produce subdomains `feat-foo.localhost` and `feat-bar.localhost` and coexist without conflict.

## Example (real, captured during end-to-end test 2026-04-27)

```json
{
  "bootedAt": "2026-04-27T19:36:54Z",
  "branch": "feat/m125-lane-b-dev-skill-properly-structured",
  "subdomain": "feat-m125-lane-b-dev-skill-properly-structured.localhost",
  "baseUrl": "https://feat-m125-lane-b-dev-skill-properly-structured.localhost:1355",
  "processes": {
    "portlessWrapper": {
      "pid": 86104,
      "command": "portless feat-m125-lane-b-dev-skill-properly-structured npm run dev"
    },
    "agentBrowser": {
      "sessionName": "feat-m125-lane-b-dev-skill-properly-structured"
    }
  },
  "emulators": [],
  "notes": "portless proxy daemon is shared and not tracked here — stop.sh leaves it running."
}
```
