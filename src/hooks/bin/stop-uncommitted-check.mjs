#!/usr/bin/env node
/**
 * Stop Uncommitted Changes Check (Command Hook)
 *
 * Replaces the prompt-type hook that frequently caused "JSON validation failed"
 * errors because model responses weren't always pure JSON.
 *
 * This deterministic command hook runs `git status --porcelain` and warns
 * via systemMessage if uncommitted changes exist. Does not block session exit.
 *
 * F24 (sc47): use execFileSync with argv + timeout + --no-optional-locks so a
 * hung/slow git cannot pin the Stop event loop, and so concurrent sessions
 * don't contend on the index lock. Kept SYNC in hooks.json (no `async: true`):
 * an async Stop hook's systemMessage only lands on a next turn that may never
 * exist after Stop. Deliberately NOT `-uno`: untracked files are part of the
 * warning contract (tests + UX).
 */

import { execFileSync } from 'node:child_process';

// Injected by build-plugins.sh at build time from manifests/ork.json
const PLUGIN_VERSION = '__PLUGIN_VERSION__'; // x-release-please-version

/** Silent success — tells CC to continue without showing output. */
const SILENT_OK = JSON.stringify({ continue: true, suppressOutput: true });

/** Bound the Stop-path git spawn; matches security-scan-aggregator's status probe. */
const GIT_TIMEOUT_MS = 5000;

async function main() {
  // Drain stdin (required by hook protocol)
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  // Guard against JSON leaking from hook stdout into env (#1250).
  const rawProjectDir = process.env.CLAUDE_PROJECT_DIR;
  const projectDir = rawProjectDir && !rawProjectDir.startsWith('{') && !rawProjectDir.startsWith('[')
    ? rawProjectDir
    : process.cwd();

  try {
    // One spawn: status fails outside a git work tree, so a separate rev-parse
    // probe was pure Stop-path cost. --no-optional-locks avoids index.lock
    // waits when another session is mid-commit.
    const raw = execFileSync(
      'git',
      ['--no-optional-locks', 'status', '--porcelain'],
      {
        cwd: projectDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: GIT_TIMEOUT_MS,
        windowsHide: true,
      }
    );

    // Split into lines preserving leading spaces (significant in porcelain format)
    const lines = raw.split('\n').filter((l) => l.length > 0);

    if (lines.length > 0) {
      const staged = lines.filter((l) => /^[MADRC]/.test(l)).length;
      const unstaged = lines.filter((l) => /^.[MADRC]/.test(l)).length;
      const untracked = lines.filter((l) => l.startsWith('??')).length;

      const parts = [];
      if (staged) parts.push(`${staged} staged`);
      if (unstaged) parts.push(`${unstaged} modified`);
      if (untracked) parts.push(`${untracked} untracked`);

      console.log(
        JSON.stringify({
          continue: true,
          systemMessage: `[ork@${PLUGIN_VERSION}] ${parts.join(', ')} uncommitted — do not act on these.`,
        })
      );
    } else {
      console.log(SILENT_OK);
    }
  } catch {
    // Not a git repo, git unavailable, or timed out — skip silently
    console.log(SILENT_OK);
  }
}

main().catch(() => {
  console.log(SILENT_OK);
});
