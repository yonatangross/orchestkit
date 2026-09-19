#!/usr/bin/env node
// ============================================================================
// link-graph extraction unit tests (offline, fixture-driven)
// ============================================================================
// WHAT THIS GUARDS
//
//   scripts/seo/link-graph.mjs extracts [x](y) and href= links from mdx bodies.
//   Before the stripCode pass it also read code as prose: fenced blocks and
//   inline `code` spans containing link-shaped text (regex fragments,
//   scaffolded file trees, markdown examples) fed broken-links.json. In the
//   2026-09-19 audit that was 26 of 159 broken rows and 33 of 44 non-docs
//   rows. Both ways this regresses are silent:
//
//   1. Under-strip — the code regex is dropped or loosened, code-shaped links
//      return to the audit and the broken count inflates again.
//   2. Over-strip — a fence regex that eats past the closing fence hides REAL
//      prose links after a code block, silently undercounting edges.
//
// WHY OFFLINE
//
//   Fixtures are a temp contentDir, not the real corpus: the test measures
//   the extractor, not whatever the docs happen to contain today.
// ============================================================================

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildLinkGraph } from '../../scripts/seo/link-graph.mjs';

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failures.push(`${name}\n      expected ${e}\n      actual   ${a}`);
  }
}

function withContentDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'link-graph-'));
  const write = (rel, body) => {
    const file = path.join(dir, 'docs', rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  };
  try {
    fn(dir, write);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

withContentDir((dir, write) => {
  write(
    'index.mdx',
    '---\ntitle: Home\n---\n\n# Home\n\n[Real](/docs/real)\n[Gone](/docs/gone)\n',
  );
  write('real.mdx', '---\ntitle: Real\n---\n\n# Real\n');
  const { pages, broken } = buildLinkGraph({ contentDir: dir });
  check('markdown links resolve and broken /docs targets are reported',
    [pages.get('/docs')?.outbound, broken],
    [1, [{ from: '/docs', to: '/docs/gone' }]]);
});

withContentDir((dir, write) => {
  write(
    'index.mdx',
    [
      '---', 'title: Home', '---', '',
      '# Home', '',
      '[Real](/docs/real)', '',
      '```ts',
      'const r = /[a](b)/; // link-shaped regex [x](/docs/regex-fragment)',
      'fetch(href="/docs/jsx-fragment")',
      '```', '',
      'Inline `[not a link](/docs/inline-fragment)` either.', '',
      '````markdown',
      'A nested fence example: [x](/docs/nested-fence-fragment) and ```ts',
      'const y = 1;```',
      '````',
    ].join('\n'),
  );
  write('real.mdx', '---\ntitle: Real\n---\n\n# Real\n');
  const { pages, broken, siteExternal } = buildLinkGraph({ contentDir: dir });
  check('fenced + inline code contribute no links',
    [pages.get('/docs')?.outbound, pages.get('/docs/real')?.inbound, broken, siteExternal],
    [1, 1, [], []]);
});

withContentDir((dir, write) => {
  write(
    'index.mdx',
    '---\ntitle: Home\n---\n\n# Home\n\n[Real](/docs/real)\n\n```\n[tail](/docs/tail)\n',
  );
  write('real.mdx', '---\ntitle: Real\n---\n\n# Real\n');
  const { broken } = buildLinkGraph({ contentDir: dir });
  check('unterminated fence swallows the tail, no phantom links', broken, []);
});

withContentDir((dir, write) => {
  write(
    'index.mdx',
    '---\ntitle: Home\n---\n\n# Home\n\n```\ncode\n```\n\n[After](/docs/after)\n',
  );
  const { broken } = buildLinkGraph({ contentDir: dir });
  check('prose links after a closed fence are still read', broken,
    [{ from: '/docs', to: '/docs/after' }]);
});

withContentDir((dir, write) => {
  write(
    'index.mdx',
    '---\ntitle: Home\n---\n\n# Home\n\n```\ncode\n````\n\n[After](/docs/after)\n',
  );
  const { broken } = buildLinkGraph({ contentDir: dir });
  check('prose links after a longer closing fence are still read', broken,
    [{ from: '/docs', to: '/docs/after' }]);
});

// --- report ------------------------------------------------------------------
console.log(`  passed: ${passed}`);
console.log(`  failed: ${failures.length}\n`);
if (failures.length > 0) {
  for (const f of failures) console.error(`  FAIL  ${f}`);
  process.exit(1);
}
console.log('link-graph: all assertions passed');
