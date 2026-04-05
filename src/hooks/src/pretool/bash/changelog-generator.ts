/**
 * Changelog Generator Hook
 * Suggests changelog entries for version bumps
 * CC 2.1.9: Injects changelog suggestions via additionalContext
 */

import type { HookInput, HookResult , HookContext} from '../../types.js';
import {
  outputSilentSuccess,
  outputAllowWithContext,
} from '../../lib/common.js';
import { execFileSync } from 'node:child_process';
import { NOOP_CTX } from '../../lib/context.js';

/**
 * Get recent commits for changelog
 */
function getRecentCommits(projectDir: string, since?: string): string[] {
  try {
    const args = ['log'];
    if (since) {
      args.push(`--since=${since}`);
    } else {
      args.push('--max-count=20');
    }
    args.push('--pretty=format:%s');
    const result = execFileSync('git', args, {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return result.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Group commits by type for changelog
 */
function groupCommitsByType(commits: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {
    feat: [],
    fix: [],
    refactor: [],
    docs: [],
    test: [],
    chore: [],
    other: [],
  };

  for (const commit of commits) {
    const match = commit.match(/^(feat|fix|refactor|docs|test|chore|perf|ci|build)/);
    if (match) {
      const type = match[1] === 'perf' || match[1] === 'ci' || match[1] === 'build' ? 'chore' : match[1];
      groups[type].push(commit);
    } else {
      groups.other.push(commit);
    }
  }

  return groups;
}

/**
 * Suggest changelog entries for version commands
 */
export function changelogGenerator(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const command = input.tool_input.command || '';
  const projectDir = ctx.projectDir;

  // Only process npm version, poetry version, or changelog commands
  if (!/npm\s+version|poetry\s+version|changelog/.test(command)) {
    return outputSilentSuccess();
  }

  // Get recent commits
  const commits = getRecentCommits(projectDir);

  if (commits.length === 0) {
    return outputSilentSuccess();
  }

  // Group by type
  const groups = groupCommitsByType(commits);

  // Build changelog suggestion
  const sections: string[] = [];

  if (groups.feat.length > 0) {
    sections.push(`### Features\n${groups.feat.slice(0, 5).map((c) => `- ${c}`).join('\n')}`);
  }
  if (groups.fix.length > 0) {
    sections.push(`### Bug Fixes\n${groups.fix.slice(0, 5).map((c) => `- ${c}`).join('\n')}`);
  }
  if (groups.refactor.length > 0 || groups.chore.length > 0) {
    const combined = [...groups.refactor, ...groups.chore];
    sections.push(`### Maintenance\n${combined.slice(0, 3).map((c) => `- ${c}`).join('\n')}`);
  }

  if (sections.length === 0) {
    return outputSilentSuccess();
  }

  const context = `Suggested changelog entries:

${sections.join('\n\n')}

Update CHANGELOG.md before releasing.`;

  ctx.logPermission('allow', 'Changelog suggestions generated', input);
  ctx.log('changelog-generator', `Generated ${sections.length} sections`);
  return outputAllowWithContext(context);
}
