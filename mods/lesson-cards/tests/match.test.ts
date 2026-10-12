/**
 * Unit tests for lesson-cards matcher.
 *
 * Fixtures based on the two denials from the mods-desk session:
 * 1. A grep whose pattern contains "platform" inside a heredoc does NOT match
 *    shared-primary-platform-checkout-lies (pattern is inside quotes/heredoc, blanked)
 * 2. The guard's exempt form `git -C <platform> show origin/dev:<path> | rg` does NOT match
 * 3. `gh pr view && gh pr checks` DOES match cancelled-check-is-not-pass
 * 4. `pg_dump -Fc | gzip` matches the warn entry pg-dump-fc-gzip-redundant
 */

import { describe, test, expect } from 'vitest';
import {
  matchBashCommand,
  matchFileEdit,
  matchLessonsBullet,
  matchAll,
  blankQuotedContent,
} from '../src/match.js';
import type { LessonPattern, LessonBullet } from '../src/corpus.js';

// Sample patterns from hq-ext
const patterns: LessonPattern[] = [
  {
    id: 'shared-primary-platform-checkout-lies',
    severity: 'block',
    category: 'git',
    pattern: 'platform',
    message: 'Avoid grep patterns that match "platform" - they trigger false positives',
    example_fix: 'Use specific path patterns or narrow the grep scope',
  },
  {
    id: 'cancelled-check-is-not-pass',
    severity: 'block',
    category: 'ci',
    pattern: 'gh pr checks',
    message: 'Cancelled CI tiers are not pass. Never trust a green rollup on a moved head.',
    example_fix: 'Use `gh pr view` with --json to check mergeStateStatus, or rely on merge-on-required.sh',
  },
  {
    id: 'pg-dump-fc-gzip-redundant',
    severity: 'warn',
    category: 'postgres',
    pattern: 'pg_dump.*-Fc.*\\|.*gzip',
    message: 'pg_dump -Fc output is already compressed; piping to gzip is redundant',
    example_fix: 'Remove the gzip pipe, use -Fc alone',
  },
];

const bullets: LessonBullet[] = [
  {
    heading: 'gh-api-pagination',
    text: 'Use gh api --paginate for endpoints that return arrays',
    tokens: ['gh', 'api', '--paginate'],
  },
];

describe('blankQuotedContent', () => {
  test('blanks single-quoted strings', () => {
    const result = blankQuotedContent("echo 'hello world'");
    expect(result).toBe("echo ''");
  });

  test('blanks double-quoted strings', () => {
    const result = blankQuotedContent('echo "hello world"');
    expect(result).toBe('echo ""');
  });

  test('handles escaped quotes in double-quoted strings', () => {
    const result = blankQuotedContent('echo "hello \\"world\\""');
    expect(result).toBe('echo ""');
  });

  test('handles multiple quoted strings', () => {
    const result = blankQuotedContent("echo 'foo' 'bar' \"baz\"");
    expect(result).toBe("echo '' '' \"\"");
  });
});

describe('matchBashCommand', () => {
  test('grep with "platform" in heredoc does NOT match shared-primary-platform-checkout-lies', () => {
    // The pattern "platform" is inside a heredoc path string, which gets blanked
    const command = `cat > query.sql <<'EOF'
SELECT * FROM platform_users WHERE id = 1;
EOF`;
    const matches = matchBashCommand(command, patterns);
    // Should not match because heredoc content is blanked
    expect(matches.find(m => m.id === 'shared-primary-platform-checkout-lies')).toBeUndefined();
  });

  test('grep with pattern in quoted string does NOT match platform pattern', () => {
    const command = `grep -r "platform" src/`;
    const matches = matchQuotedBashCommand(command, patterns);
    // Pattern inside quotes is blanked, so should not match
    expect(matches.find(m => m.id === 'shared-primary-platform-checkout-lies')).toBeUndefined();
  });

  test('gh pr view && gh pr checks DOES match cancelled-check-is-not-pass', () => {
    const command = 'gh pr view && gh pr checks';
    const matches = matchBashCommand(command, patterns);
    expect(matches.find(m => m.id === 'cancelled-check-is-not-pass')).toBeDefined();
  });

  test('pg_dump -Fc piped to gzip matches warn entry', () => {
    const command = 'pg_dump -Fc mydb | gzip > backup.dump.gz';
    const matches = matchBashCommand(command, patterns);
    expect(matches.find(m => m.id === 'pg-dump-fc-gzip-redundant')).toBeDefined();
  });

  test('returns at most one match for block patterns', () => {
    const command = 'gh pr view && gh pr checks';
    const matches = matchBashCommand(command, patterns);
    const blockMatches = matches.filter(m => m.severity === 'block');
    expect(blockMatches.length).toBeLessThanOrEqual(1);
  });
});

// Helper to test quoted string blanking
function matchQuotedBashCommand(command: string, patterns: LessonPattern[]): ReturnType<typeof matchBashCommand> {
  // The actual matchBashCommand blanks quoted content before matching
  // This is already implemented in matchBashCommand
  return matchBashCommand(command, patterns);
}

describe('matchLessonsBullet', () => {
  test('gh api --paginate matches indexed bullet', () => {
    const command = 'gh api --paginate repos/owner/repo/issues';
    const match = matchLessonsBullet(command, bullets);
    expect(match).toBeDefined();
    expect(match?.id).toBe('gh-api-pagination');
  });

  test('gh api without --paginate does not match', () => {
    const command = 'gh api repos/owner/repo/issues';
    const match = matchLessonsBullet(command, bullets);
    expect(match).toBeNull();
  });
});

describe('matchAll', () => {
  test('guard pattern takes priority over bullet', () => {
    const command = 'gh pr view && gh pr checks';
    const matches = matchAll(command, patterns, bullets);
    expect(matches.length).toBe(1);
    expect(matches[0].id).toBe('cancelled-check-is-not-pass');
    expect(matches[0].source).toBe('pattern');
  });

  test('bullet matches when no pattern matches', () => {
    const command = 'gh api --paginate repos/owner/repo/issues';
    const matches = matchAll(command, patterns, bullets);
    expect(matches.length).toBe(1);
    expect(matches[0].source).toBe('bullet');
  });

  test('returns empty array when nothing matches', () => {
    const command = 'echo hello world';
    const matches = matchAll(command, patterns, bullets);
    expect(matches).toEqual([]);
  });
});

describe('matchFileEdit', () => {
  test('matches file_glob pattern', () => {
    const filePatterns: LessonPattern[] = [
      {
        id: 'env-no-secrets',
        severity: 'warn',
        category: 'security',
        file_glob: '**/.env',
        message: '.env files should not contain secrets',
      },
    ];

    const matches = matchFileEdit('.env', 'SECRET=value', filePatterns);
    expect(matches.find(m => m.id === 'env-no-secrets')).toBeDefined();
  });

  test('respects exclude_paths', () => {
    const filePatterns: LessonPattern[] = [
      {
        id: 'env-no-secrets',
        severity: 'warn',
        category: 'security',
        file_glob: '**/.env',
        exclude_paths: ['**/.env.example'],
        message: '.env files should not contain secrets',
      },
    ];

    const matches = matchFileEdit('.env.example', 'SECRET=value', filePatterns);
    expect(matches.find(m => m.id === 'env-no-secrets')).toBeUndefined();
  });
});

describe('repo filtering', () => {
  test('respects repos filter', () => {
    const repoPatterns: LessonPattern[] = [
      {
        id: 'platform-specific',
        severity: 'warn',
        category: 'repo',
        pattern: 'platform',
        repos: ['yonatangross/platform'],
        message: 'Platform repo has special rules',
      },
    ];

    // Match when repo matches
    const matches = matchBashCommand('grep platform', repoPatterns, 'yonatangross/platform');
    expect(matches.find(m => m.id === 'platform-specific')).toBeDefined();

    // No match when repo does not match
    const noMatches = matchBashCommand('grep platform', repoPatterns, 'yonatangross/other');
    expect(noMatches.find(m => m.id === 'platform-specific')).toBeUndefined();
  });
});

// The shapes below are copied from the live corpus (hq-ext 1.65.0
// configs/lesson-patterns.json): 18 of its 31 entries carry file_glob and a
// content regex in `pattern` or `trigger_pattern`, and no check_patterns.
// 2 lanes were stopped on 2026-10-12 by "Proceed anyway?" dialogs for a block
// entry like this one firing on every .py write.
describe('matchFileEdit with the real corpus shape', () => {
  const langfuse: LessonPattern = {
    id: 'langfuse-v4-client',
    severity: 'block',
    category: 'prompt_quality',
    pattern: '\\.client\\.client[.\\[]|\\b(?:langfuse|lf)\\.client\\s*[.\\[]',
    file_glob: '**/*.py',
    exclude_paths: ['/tests/', '.md', 'pretool-lesson-guard', '/configs/'],
    message: 'Langfuse v4 removed the .client reach-in.',
  };
  const window: LessonPattern = {
    id: 'httpx-catch-builtins-only',
    severity: 'warn',
    category: 'quality',
    trigger_pattern: 'except\\s+\\(?(?:ConnectionError|TimeoutError)',
    file_glob: '**/*.py',
    exclude_paths: ['/tests/'],
    message: 'Catch httpx errors, not builtins.',
  };

  test('a glob-plus-pattern entry does not fire on unrelated content', () => {
    expect(matchFileEdit('src/app/service.py', 'def add(a, b):\n    return a + b\n', [langfuse])).toEqual([]);
  });

  test('the same entry fires when the content holds its pattern', () => {
    const hit = matchFileEdit('src/app/service.py', 'scores = langfuse.client.score.list()', [langfuse]);
    expect(hit.map(m => m.id)).toEqual(['langfuse-v4-client']);
  });

  test('a trigger_pattern entry is tested against the content too', () => {
    expect(matchFileEdit('src/app/io.py', 'x = 1', [window])).toEqual([]);
    const hit = matchFileEdit('src/app/io.py', 'try:\n    pass\nexcept (ConnectionError, OSError):\n    pass', [window]);
    expect(hit.map(m => m.id)).toEqual(['httpx-catch-builtins-only']);
  });

  test('an exclude_paths substring excludes the file', () => {
    const body = 'scores = langfuse.client.score.list()';
    expect(matchFileEdit('apps/api/tests/test_scores.py', body, [langfuse])).toEqual([]);
    expect(matchFileEdit('apps/api/configs/x.py', body, [langfuse])).toEqual([]);
    expect(matchFileEdit('apps/api/src/scores.py', body, [langfuse]).length).toBe(1);
  });

  test('a glob-only entry with no content regex still matches on the file alone', () => {
    const fileOnly: LessonPattern = { id: 'g', severity: 'warn', category: 'x', file_glob: '**/*.py', message: 'm' };
    expect(matchFileEdit('a/b.py', 'anything', [fileOnly]).map(m => m.id)).toEqual(['g']);
  });
});

describe('matchFileEdit severity order', () => {
  test('a block match comes first even when a warn pattern is listed before it', () => {
    const patterns = [
      { id: 'warn-first', severity: 'warn' as const, category: 'x', file_glob: '**/*.py', check_patterns: ['danger'], message: 'warn' },
      { id: 'block-second', severity: 'block' as const, category: 'x', file_glob: '**/*.py', check_patterns: ['danger'], message: 'block' },
      { id: 'warn-third', severity: 'warn' as const, category: 'x', file_glob: '**/*.py', check_patterns: ['danger'], message: 'warn' },
    ];
    const ids = matchFileEdit('src/a.py', 'danger', patterns).map(x => x.id);
    expect(ids).toEqual(['block-second', 'warn-first', 'warn-third']);
  });
});
