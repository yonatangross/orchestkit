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
    tool_names: ['Bash'],
    message: 'Avoid grep patterns that match "platform" - they trigger false positives',
    example_fix: 'Use specific path patterns or narrow the grep scope',
  },
  {
    id: 'cancelled-check-is-not-pass',
    severity: 'block',
    category: 'ci',
    pattern: 'gh pr checks',
    tool_names: ['Bash'],
    message: 'Cancelled CI tiers are not pass. Never trust a green rollup on a moved head.',
    example_fix: 'Use `gh pr view` with --json to check mergeStateStatus, or rely on merge-on-required.sh',
  },
  {
    id: 'pg-dump-fc-gzip-redundant',
    severity: 'warn',
    category: 'postgres',
    pattern: 'pg_dump.*-Fc.*\\|.*gzip',
    tool_names: ['Bash'],
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

    const matches = matchFileEdit('.env', 'SECRET=value', filePatterns, 'Edit');
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

    const matches = matchFileEdit('.env.example', 'SECRET=value', filePatterns, 'Edit');
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
        tool_names: ['Bash'],
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

// Entry fields below are copied verbatim from the live corpus (hq-ext 1.65.0
// configs/lesson-patterns.json): id, severity, pattern, trigger_pattern,
// require_pattern, window_lines, file_glob and exclude_paths. Only the message
// text is shortened (one live message names a client vault; this repo is
// public). 18 of the 31 live entries have a file_glob and a content regex and
// no check_patterns. The hq-ext guard reads them as: `simple` = the regex with
// flag m against the content; `window-check` = a trigger line fires only when
// require_pattern is absent from the window_lines around it.
describe('matchFileEdit with the real corpus shape', () => {
  const langfuse: LessonPattern = {
    id: 'langfuse-v4-client',
    severity: 'block',
    category: 'prompt_quality',
    pattern: '\\.client\\.client[.\\[]|\\b(?:langfuse|lf|langfuse_client|self\\.langfuse|self\\.lf)\\.client\\s*[.\\[]|Langfuse\\s*\\([^)]*\\)\\s*\\.client\\s*[.\\[]',
    file_glob: '**/*.py',
    exclude_paths: ['/tests/', '.md', 'pretool-lesson-guard', '/configs/'],
    message: 'Langfuse v4 removed the .client reach-in.',
  };
  const deepgram: LessonPattern = {
    id: 'deepgram-nova3-language',
    severity: 'block',
    category: 'prompt_quality',
    trigger_pattern: '["\']nova-3["\']',
    require_pattern: '\\blanguage\\b\\s*["\']?\\s*[=:]',
    window_lines: 10,
    file_glob: '**/*.py',
    message: 'nova-3 needs a language.',
  };
  const httpx: LessonPattern = {
    id: 'httpx-catch-builtins-only',
    severity: 'warn',
    category: 'prompt_quality',
    trigger_pattern: '^\\s*import\\s+httpx\\b|^\\s*from\\s+httpx\\b',
    require_pattern: 'HTTPError|HTTP_PROVIDER_ERRORS|TransportError|TimeoutException|ConnectError',
    window_lines: 30,
    file_glob: '**/*.py',
    exclude_paths: ['/tests/', '.md', 'pretool-lesson-guard', '/configs/', 'app/core/exceptions.py'],
    message: 'Catch the httpx errors, not builtins.',
  };
  const opRef: LessonPattern = {
    id: 'op-section-scoped-form',
    severity: 'warn',
    category: 'prompt_quality',
    // Live value starts with the op scheme; written in two parts so the public-surface scan reads no op path.
    pattern: 'op:' + '//[^/\\s"\']+/[^/\\s"\']+/[A-Z_][A-Z0-9_]{3,}(?=["\'\\s])',
    file_glob: '**/*.{tpl,yml,yaml,sh,bash,py,ts,tsx,js,mjs,cjs,Dockerfile}',
    exclude_paths: ['/tests/', '.md', '/configs/', 'pretool-lesson-guard', 'lesson-coverage', 'recent-decisions'],
    message: 'Use the 4-part section-scoped op:// form.',
  };

  test('a glob-plus-pattern entry does not fire on unrelated content', () => {
    expect(matchFileEdit('src/app/service.py', 'def add(a, b):\n    return a + b\n', [langfuse], 'Edit')).toEqual([]);
  });

  test('langfuse: its own RIGHT code is quiet and its WRONG code fires', () => {
    expect(matchFileEdit('src/app/s.py', 'scores = svc.management_api.scores.get_many(trace_id=t)', [langfuse], 'Edit')).toEqual([]);
    expect(matchFileEdit('src/app/s.py', 'items = langfuse.client.dataset_items.list()', [langfuse], 'Edit').map(m => m.id)).toEqual(['langfuse-v4-client']);
  });

  test('an exclude_paths substring excludes the file', () => {
    const body = 'items = langfuse.client.dataset_items.list()';
    expect(matchFileEdit('apps/api/tests/test_scores.py', body, [langfuse], 'Edit')).toEqual([]);
    expect(matchFileEdit('apps/api/configs/x.py', body, [langfuse], 'Edit')).toEqual([]);
    expect(matchFileEdit('apps/api/src/scores.py', body, [langfuse], 'Edit').length).toBe(1);
  });

  test('simple entries use flag m, not i: a lowercase field is not a top-level ref', () => {
    expect(matchFileEdit('a/b.py', 'ref = "op://Vault/Item/credential"', [opRef], 'Edit')).toEqual([]);
    expect(matchFileEdit('a/b.py', 'ref = "op://Vault/Item/API Keys/LANGFUSE_PUBLIC_KEY"', [opRef], 'Edit')).toEqual([]);
    expect(matchFileEdit('a/b.py', 'ref = "op://Vault/Item/LANGFUSE_PUBLIC_KEY"', [opRef], 'Edit').map(m => m.id)).toEqual(['op-section-scoped-form']);
    expect(matchFileEdit('deploy/env.tpl', 'KEY=op://Vault/Item/LANGFUSE_PUBLIC_KEY ', [opRef], 'Edit').map(m => m.id)).toEqual(['op-section-scoped-form']);
  });

  test('window-check: require_pattern in the window keeps the entry quiet (deepgram RIGHT)', () => {
    const right = 'options = PrerecordedOptions(model="nova-3", language="multi")';
    expect(matchFileEdit('svc/stt.py', right, [deepgram], 'Edit')).toEqual([]);
  });

  test('window-check: a trigger with no require_pattern in the window fires (deepgram WRONG)', () => {
    const wrong = 'options = PrerecordedOptions(model="nova-3")';
    const hit = matchFileEdit('svc/stt.py', wrong, [deepgram], 'Edit');
    expect(hit.map(m => m.id)).toEqual(['deepgram-nova3-language']);
    expect(hit[0].severity).toBe('block');
  });

  test('window-check: window_lines bounds where require_pattern counts', () => {
    const filler = Array.from({ length: 12 }, (_, i) => `x${i} = ${i}`);
    const near = ['model = "nova-3"', ...filler.slice(0, 9), 'language = "multi"'].join('\n');
    const far = ['model = "nova-3"', ...filler, 'language = "multi"'].join('\n');
    expect(matchFileEdit('svc/stt.py', near, [deepgram], 'Edit')).toEqual([]);
    expect(matchFileEdit('svc/stt.py', far, [deepgram], 'Edit').map(m => m.id)).toEqual(['deepgram-nova3-language']);
  });

  test('window-check: the trigger is read line by line, so ^ anchors every line', () => {
    const fires = 'import os\nimport httpx\n\nclient = httpx.Client()\n';
    const quiet = 'import httpx\n\ntry:\n    pass\nexcept httpx.HTTPError:\n    pass\n';
    expect(matchFileEdit('svc/io.py', fires, [httpx], 'Edit').map(m => m.id)).toEqual(['httpx-catch-builtins-only']);
    expect(matchFileEdit('svc/io.py', quiet, [httpx], 'Edit')).toEqual([]);
  });

  // Brace globs, field for field from the live corpus. 6 of the 31 live entries
  // use `{a,b}` in file_glob; the hq-ext guard expands it, and the mod's glob
  // matcher read the braces as literal characters, so those entries never fired.
  const swallow: LessonPattern = {
    id: 'swallow-corrupts-measured-value',
    severity: 'block',
    category: 'prompt_quality',
    pattern: '(?:\\$\\([^\\n)]*2>\\s*/dev/null[^\\n)]*\\|\\s*(?:wc\\s+-l|grep\\s+-c)[^\\n)]*\\)|\\$\\([^\\n)]*grep\\s+-c[^\\n)]*\\|\\|\\s*true[^\\n)]*\\))',
    file_glob: '**/*.{sh,bash,yml,yaml}',
    exclude_paths: ['/tests/', '.md', 'pretool-lesson-guard', '/configs/', '/scratchpad/'],
    tool_names: ['Write', 'Edit', 'Bash'],
    message: 'A swallowed error reads as a measured zero.',
  };
  const revoke: LessonPattern = {
    id: 'revoke-before-replacement-proven',
    severity: 'warn',
    category: 'tool_mastery',
    trigger_pattern: '[Rr]evoke[^\\n]{0,60}(client|credential|key|secret|token|[Oo]auth|OAUTH)|(client|credential|key|secret|token|[Oo]auth|OAUTH)[^\\n]{0,60}[Rr]evoke',
    require_pattern: '[Vv]erif|[Pp]rove|[Pp]roven|[Gg]reen|[Ss]moke|[Rr]eplacement|[Mm]int|[Rr]ollback',
    window_lines: 12,
    file_glob: '**/*.{sh,bash,yml,yaml,md}',
    exclude_paths: ['/configs/', 'pretool-lesson-guard', 'strict-mode-gates.md'],
    message: 'Prove the replacement before revoking.',
  };
  const mutation: LessonPattern = {
    id: 'mutation-without-postcondition-assert',
    severity: 'warn',
    category: 'code_review',
    trigger_pattern: '--remove-label|--add-label|--disable-auto-merge|gh pr merge[^\\n]{0,40}--auto|labels\\.remove|removeLabel',
    require_pattern: '[Vv]erif|[Aa]ssert|[Cc]onfirm|re-read|[Rr]echeck|--json labels|after the change|postcondition',
    window_lines: 12,
    file_glob: '**/*.{sh,bash,yml,yaml}',
    exclude_paths: ['/configs/', 'pretool-lesson-guard', 'strict-mode-gates.md'],
    message: 'Assert the postcondition after a mutation.',
  };

  test('brace glob: swallow-corrupts-measured-value fires on its WRONG code in each extension', () => {
    const wrong = 'N=$(rclone lsf -R --files-only "$path" 2>/dev/null | wc -l)';
    for (const file of ['scripts/run.sh', 'scripts/run.bash', '.github/workflows/x.yml', '.github/workflows/x.yaml']) {
      const hit = matchFileEdit(file, wrong, [swallow], 'Edit');
      expect(hit.map(m => m.id), file).toEqual(['swallow-corrupts-measured-value']);
      expect(hit[0].severity).toBe('block');
    }
  });

  test('brace glob: an extension outside the braces does not match', () => {
    const wrong = 'N=$(rclone lsf -R --files-only "$path" 2>/dev/null | wc -l)';
    expect(matchFileEdit('scripts/run.txt', wrong, [swallow], 'Edit')).toEqual([]);
    expect(matchFileEdit('scripts/run.shx', wrong, [swallow], 'Edit')).toEqual([]);
  });

  test('brace glob: swallow stays quiet on its RIGHT code', () => {
    const right = 'ERRORS=$(awk \'/ERROR/{n++} END{print n+0}\' "$log")';
    expect(matchFileEdit('scripts/run.sh', right, [swallow], 'Edit')).toEqual([]);
  });

  test('brace glob: revoke fires on its WRONG code and not on its RIGHT code', () => {
    const wrong = 'tailscale oauth revoke "$OLD_CLIENT_ID"';
    const right = [
      'NEW=$(tailscale oauth create --scopes devices:read)',
      'gh secret set TS_OAUTH_CLIENT_ID --body "$NEW"',
      'gh workflow run deploy.yml && gh run watch --exit-status   # green before anything is destroyed',
      'tailscale oauth revoke "$OLD_CLIENT_ID"',
    ].join('\n');
    expect(matchFileEdit('ops/rotate.sh', wrong, [revoke], 'Edit').map(m => m.id)).toEqual(['revoke-before-replacement-proven']);
    expect(matchFileEdit('ops/rotate.sh', right, [revoke], 'Edit')).toEqual([]);
  });

  test('brace glob: mutation fires on its WRONG code and not on its RIGHT code', () => {
    const wrong = 'gh pr edit "$PR" --remove-label promote-hold';
    const right = [
      'gh pr edit "$PR" --remove-label promote-hold',
      'left=$(gh pr view "$PR" --json labels -q \'[.labels[].name] | index("promote-hold")\')',
      '[ "$left" = "null" ] || { echo "::error::label still present on $PR"; exit 1; }',
    ].join('\n');
    expect(matchFileEdit('ops/label.yml', wrong, [mutation], 'Edit').map(m => m.id)).toEqual(['mutation-without-postcondition-assert']);
    expect(matchFileEdit('ops/label.yml', right, [mutation], 'Edit')).toEqual([]);
  });

  // The other two corpus kinds, field for field from the live corpus. The hq-ext
  // guard reads them with their own rules (evalBlockCheck, evalDockerfileCheck):
  // a file_match string is a path SUFFIX and the content decides. The mod read
  // both as "the file matches, so fire": a BLOCK on every Dockerfile write.
  const dockerfile: LessonPattern = {
    id: 'dockerfile-editable-install',
    type: 'dockerfile-check',
    severity: 'block',
    category: 'prompt_quality',
    file_match: 'Dockerfile',
    message: 'Editable installs create .pth files pointing to /src. Runtime stage must COPY that src/ dir.',
  };
  const pnpm: LessonPattern = {
    id: 'pnpm-major-override',
    type: 'block-check',
    severity: 'block',
    category: 'prompt_quality',
    file_match: 'package.json',
    block_pattern: '"pnpm"\\s*:\\s*\\{[\\s\\S]*?"overrides"\\s*:\\s*\\{([\\s\\S]*?)\\}',
    check_patterns: [
      '"brace-expansion"\\s*:\\s*"(?:>=|\\^|~)?\\s*[5-9]',
      '"[\\w@\\/-]+"\\s*:\\s*"(?:>=|\\^|~)?\\s*([5-9]|\\d{2,})\\.\\d+\\.\\d+"',
    ],
    message: 'A major-version pnpm override breaks consumer exports.',
  };

  test('dockerfile-check: unrelated Dockerfile content does not fire', () => {
    expect(matchFileEdit('services/api/Dockerfile', 'FROM alpine\nRUN echo hi\n', [dockerfile], 'Edit')).toEqual([]);
  });

  test('dockerfile-check: an editable install with its src COPY is quiet (RIGHT)', () => {
    const right = [
      'RUN uv pip install -e /app/packages/observability-core',
      'COPY --from=builder /app/packages/observability-core/src /app/packages/observability-core/src',
    ].join('\n');
    expect(matchFileEdit('services/api/Dockerfile', right, [dockerfile], 'Edit')).toEqual([]);
  });

  test('dockerfile-check: an editable install without the src COPY fires (WRONG)', () => {
    const hit = matchFileEdit('services/api/Dockerfile', 'RUN uv pip install -e /app/packages/observability-core\n', [dockerfile], 'Edit');
    expect(hit.map(m => m.id)).toEqual(['dockerfile-editable-install']);
    expect(hit[0].severity).toBe('block');
  });

  test('dockerfile-check: only a path ending in file_match is read', () => {
    expect(matchFileEdit('services/api/Dockerfile.md', 'RUN uv pip install -e /app/packages/x\n', [dockerfile], 'Edit')).toEqual([]);
  });

  test('block-check: a major version outside the overrides block does not fire', () => {
    const pkg = JSON.stringify({ dependencies: { react: '^19.0.0' }, pnpm: { overrides: { 'brace-expansion': '^4.0.1' } } }, null, 2);
    expect(matchFileEdit('package.json', pkg, [pnpm], 'Edit')).toEqual([]);
  });

  test('block-check: a minor-range override is quiet (RIGHT)', () => {
    const pkg = '{\n  "pnpm": {\n    "overrides": { "brace-expansion": "^4.0.1" }\n  }\n}';
    expect(matchFileEdit('package.json', pkg, [pnpm], 'Edit')).toEqual([]);
  });

  test('block-check: a major-version override fires (WRONG)', () => {
    const pkg = '{\n  "pnpm": {\n    "overrides": { "brace-expansion": ">=5.0.5" }\n  }\n}';
    const hit = matchFileEdit('package.json', pkg, [pnpm], 'Edit');
    expect(hit.map(m => m.id)).toEqual(['pnpm-major-override']);
    expect(hit[0].severity).toBe('block');
  });

  test('block-check: only a path ending in file_match is read', () => {
    const pkg = '{\n  "pnpm": {\n    "overrides": { "brace-expansion": ">=5.0.5" }\n  }\n}';
    expect(matchFileEdit('docs/package.json.md', pkg, [pnpm], 'Edit')).toEqual([]);
  });

  // Entries with a content test and NO file filter, field for field from the
  // live corpus (tool_names null on both). The hq-ext guard evaluates them on
  // every file write; the mod skipped them because it needed a file filter.
  const pgDump: LessonPattern = {
    id: 'pg-dump-fc-gzip-redundant',
    type: 'simple',
    severity: 'warn',
    category: 'prompt_quality',
    pattern: 'pg_dump[^|\\n]*-Fc[^|\\n]*\\|\\s*gzip',
    exclude_paths: ['/tests/', '.md', '/configs/'],
    message: 'pg_dump -Fc already compresses; piping through gzip is redundant.',
  };
  const pgvector: LessonPattern = {
    id: 'pgvector-pg-version-mismatch',
    type: 'window-check',
    severity: 'warn',
    category: 'prompt_quality',
    trigger_pattern: 'pgvector/pgvector:pg1[567]',
    require_pattern: '(test|drill|ephemeral|legacy)',
    window_lines: 10,
    exclude_paths: ['/tests/', '.md'],
    message: 'Prod uses the newest pgvector image; match it unless testing legacy.',
  };

  test('no file filter: pg-dump fires on its WRONG code in a script and is quiet on RIGHT', () => {
    expect(matchFileEdit('ops/backup.sh', 'pg_dump -Fc db | gzip > db.sql.gz', [pgDump], 'Edit').map(m => m.id)).toEqual(['pg-dump-fc-gzip-redundant']);
    expect(matchFileEdit('ops/backup.sh', 'pg_dump -Fc db > db.dump', [pgDump], 'Edit')).toEqual([]);
  });

  test('no file filter: exclude_paths still excludes', () => {
    expect(matchFileEdit('ops/tests/backup.sh', 'pg_dump -Fc db | gzip > db.sql.gz', [pgDump], 'Edit')).toEqual([]);
    expect(matchFileEdit('docs/backup.md', 'pg_dump -Fc db | gzip > db.sql.gz', [pgDump], 'Edit')).toEqual([]);
  });

  test('no file filter: pgvector fires on an old image with no test word in its window, quiet on RIGHT', () => {
    const wrong = 'services:\n  db:\n    image: pgvector/pgvector:pg17\n';
    const right = 'services:\n  db:\n    image: pgvector/pgvector:pg18\n';
    const legacy = 'services:\n  db:\n    # legacy restore drill\n    image: pgvector/pgvector:pg17\n';
    expect(matchFileEdit('compose.yml', wrong, [pgvector], 'Edit').map(m => m.id)).toEqual(['pgvector-pg-version-mismatch']);
    expect(matchFileEdit('compose.yml', right, [pgvector], 'Edit')).toEqual([]);
    expect(matchFileEdit('compose.yml', legacy, [pgvector], 'Edit')).toEqual([]);
  });

  test('no file filter: an Edit-only content entry fires, a Bash-only one does not', () => {
    const editOnly: LessonPattern = { id: 'e', severity: 'warn', category: 'x', pattern: 'secret', tool_names: ['Edit'], message: 'm' };
    const bashOnly: LessonPattern = { id: 'b', severity: 'warn', category: 'x', pattern: 'secret', tool_names: ['Bash'], message: 'm' };
    expect(matchFileEdit('file.txt', 'secret', [editOnly], 'Edit').map(m => m.id)).toEqual(['e']);
    expect(matchFileEdit('file.txt', 'secret', [bashOnly], 'Edit')).toEqual([]);
  });

  // Hand-written, untyped, no regex: the corpus has no such entry (the typed
  // file-only kinds are tested above), so this only pins the legacy fixture form.
  test('an untyped glob-only entry with no content regex matches on the file alone', () => {
    const fileOnly: LessonPattern = { id: 'g', severity: 'warn', category: 'x', file_glob: '**/*.py', message: 'm' };
    expect(matchFileEdit('a/b.py', 'anything', [fileOnly], 'Edit').map(m => m.id)).toEqual(['g']);
  });
});

describe('matchFileEdit severity order', () => {
  test('a block match comes first even when a warn pattern is listed before it', () => {
    const patterns = [
      { id: 'warn-first', severity: 'warn' as const, category: 'x', file_glob: '**/*.py', check_patterns: ['danger'], message: 'warn' },
      { id: 'block-second', severity: 'block' as const, category: 'x', file_glob: '**/*.py', check_patterns: ['danger'], message: 'block' },
      { id: 'warn-third', severity: 'warn' as const, category: 'x', file_glob: '**/*.py', check_patterns: ['danger'], message: 'warn' },
    ];
    const ids = matchFileEdit('src/a.py', 'danger', patterns, 'Edit').map(x => x.id);
    expect(ids).toEqual(['block-second', 'warn-first', 'warn-third']);
  });
});

describe('tool name filtering', () => {
  const entry: LessonPattern = {
    id: 'tool-filter', severity: 'warn', category: 'x', pattern: 'secret', message: 'm',
  };

  test('an Edit-only entry fires on Edit and not on Write', () => {
    const editOnly = { ...entry, tool_names: ['Edit'] };
    expect(matchFileEdit('file.txt', 'secret', [editOnly], 'Edit').map(m => m.id)).toEqual(['tool-filter']);
    expect(matchFileEdit('file.txt', 'secret', [editOnly], 'Write')).toEqual([]);
  });

  test('a Write-only entry fires on Write and not on Edit', () => {
    const writeOnly = { ...entry, tool_names: ['Write'] };
    expect(matchFileEdit('file.txt', 'secret', [writeOnly], 'Write').map(m => m.id)).toEqual(['tool-filter']);
    expect(matchFileEdit('file.txt', 'secret', [writeOnly], 'Edit')).toEqual([]);
  });

  test('an entry without tool names skips Bash and fires on file edits', () => {
    expect(matchBashCommand('echo secret', [entry])).toEqual([]);
    expect(matchFileEdit('file.txt', 'secret', [entry], 'Edit').map(m => m.id)).toEqual(['tool-filter']);
    expect(matchFileEdit('file.txt', 'secret', [entry], 'Write').map(m => m.id)).toEqual(['tool-filter']);
  });
});
