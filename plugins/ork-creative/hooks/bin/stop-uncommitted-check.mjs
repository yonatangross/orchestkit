#!/usr/bin/env node
/**
 * Stop Uncommitted Changes Check (Command Hook)
 *
 * Replaces the prompt-type hook that frequently caused "JSON validation failed"
 * errors because model responses weren't always pure JSON.
 *
 * This deterministic command hook runs `git status --porcelain` and warns
 * via systemMessage if uncommitted changes exist. Does not block session exit.
 */

import { execSync } from 'node:child_process';

async function main() {
  // Drain stdin (required by hook protocol)
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  try {
    // Check if we're in a git repo
    execSync('git rev-parse --is-inside-work-tree', {
      cwd: projectDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Check for uncommitted changes (staged + unstaged + untracked)
    const status = execSync('git status --porcelain', {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (status) {
      const lines = status.split('\n');
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
          systemMessage: `Stop says: Uncommitted changes (${parts.join(', ')}). DO NOT investigate or act on these — the user chose to stop. Just acknowledge and stop.`,
        })
      );
    } else {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
    }
  } catch {
    // Not a git repo or git not available — skip silently
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}

main().catch(() => {
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
});
