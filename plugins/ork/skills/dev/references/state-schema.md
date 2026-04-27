# `.claude/state/dev-stack.json` schema

Written atomically by `/ork:dev`. Read by `/ork:dev status`, `/ork:dev stop`, the `ui-change-detector` hook, and the `expect-snapshot-recorder` hook.

```typescript
interface DevStackState {
  bootedAt: string;        // ISO 8601, set once at boot
  branch: string;          // git branch at boot time
  subdomain: string;       // portless domain — e.g. "feat-m125-lane-b.localhost"
  baseUrl: string;         // "https://" + subdomain
  processes: {
    portless?: {
      pid: number;
      command: string;     // for diagnostic display
    };
    emulate?: {
      pid: number;
      command: string;
    };
    devServer?: {
      pid: number;
      command: string;     // "pnpm dev" / "npm run dev" / etc.
    };
    agentBrowser?: {
      sessionName: string; // == subdomain
      pid?: number;        // optional; agent-browser daemon may be detached
    };
  };
  emulators: string[];     // service names — ["github", "stripe", "google-oauth"]
}
```

## Liveness probe

A "live" stack has at least one PID in `processes` that responds to `process.kill(pid, 0)`. If all PIDs are dead, treat the file as stale and offer to clear it.

## Reader contract

External consumers (other hooks, skills) MUST treat the file as read-only and tolerate it not existing. The shared library `src/hooks/src/lib/dev-stack-state.ts` exposes `readDevStackState()` which returns `null` for missing/malformed files — never throws.

## Writer contract

Only `/ork:dev` writes the full state. Hooks may mutate individual fields (e.g. `expect-snapshot-recorder` does NOT touch this file — snapshots go to the memory graph, not here). If a future feature needs to amend dev-stack state, do it through `writeDevStackState()` for atomicity.

## Worktree isolation

Each git worktree has its own `.claude/state/` directory, so state files don't cross worktree boundaries. This is the correct behavior — separate worktrees should have separate subdomains.
