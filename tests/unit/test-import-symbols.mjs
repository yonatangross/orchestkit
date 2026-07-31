#!/usr/bin/env node
// ============================================================================
// import-symbols unit tests (offline)
// ============================================================================
// WHAT THIS GUARDS
//
//   The import-symbol gate reports "symbol X is not exported by package P". A FALSE POSITIVE
//   there is worse than no gate: it accuses correct code, and the first response to a gate that
//   accuses correct code is to mute it. This repo has already killed one lexical scanner for
//   exactly that.
//
//   The parser originally matched only `export { A, B }`. Real .d.ts files also emit
//   `export type { A, B }` — vitest@4.1.10 ends with exactly that form. Every symbol in such a
//   block was invisible, so importing one produced a confident, wrong "not exported" report.
//   Found by adversarial verification, fixed, and locked here.
// ============================================================================

import {
  tsFences,
  namedImports,
  splitSpecifier,
  parseExports,
  typePaths,
} from '../../scripts/lib/import-symbols.mjs';

let passed = 0;
const failures = [];
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`${name}\n      expected ${e}\n      actual   ${a}`);
}

console.log('==========================================');
console.log('  import-symbols');
console.log('==========================================\n');

// --- THE REGRESSION: type-only export blocks ---------------------------------
const vitestShape = 'export type { AssertType, BrowserUI, VitestUtils, WebSocketRPC };';
const vx = parseExports(vitestShape);
check('export type {...} names are collected', [...vx.names].sort(), ['AssertType', 'BrowserUI', 'VitestUtils', 'WebSocketRPC']);
check('plain export {...} still works', [...parseExports('export { A, B };').names].sort(), ['A', 'B']);
check('inline type modifier is stripped', [...parseExports('export { type C, D };').names].sort(), ['C', 'D']);
check('aliased export records the EXPORTED name', [...parseExports('export { X as PublicName };').names], ['PublicName']);
check(
  'both forms in one file',
  [...parseExports('export { A };\nexport type { B };').names].sort(),
  ['A', 'B']
);

// --- declaration forms -------------------------------------------------------
check('declare class', parseExports('export declare class Foo {}').names.has('Foo'), true);
check('declare function', parseExports('export declare function bar(): void').names.has('bar'), true);
check('interface', parseExports('export interface Baz {}').names.has('Baz'), true);
check('type alias', parseExports('export type Qux = string').names.has('Qux'), true);

// --- self-containment: `export *` means an absence proves nothing ------------
check('export * marks NOT self-contained', parseExports('export * from "./other";').selfContained, false);
check('no star export is self-contained', parseExports('export { A };').selfContained, true);

// --- import extraction -------------------------------------------------------
check(
  'named import',
  namedImports('import { A, B as C, type D } from "pkg";'),
  [{ spec: 'pkg', symbols: ['A', 'B', 'D'] }]
);
check('type-only import statement is captured', namedImports('import type { E } from "pkg";'), [{ spec: 'pkg', symbols: ['E'] }]);
check('default import is ignored (cannot be falsified)', namedImports('import X from "pkg";'), []);
check('namespace import is ignored', namedImports('import * as ns from "pkg";'), []);

// --- specifier classification ------------------------------------------------
check('relative', splitSpecifier('./catalog').kind, 'relative');
check('node: prefix', splitSpecifier('node:fs').kind, 'builtin');
check('bare builtin', splitSpecifier('fs').kind, 'builtin');
check('scoped root', splitSpecifier('@langfuse/otel'), { kind: 'package', root: '@langfuse/otel', subpath: '' });
check('scoped subpath', splitSpecifier('@json-render/react/schema'), { kind: 'package', root: '@json-render/react', subpath: 'schema' });
check('unscoped subpath', splitSpecifier('motion/react'), { kind: 'package', root: 'motion', subpath: 'react' });

// --- fences ------------------------------------------------------------------
check('ts fence extracted', tsFences('```ts\nconst a=1\n```').length, 1);
check('typescript fence extracted', tsFences('```typescript\nconst a=1\n```').length, 1);
check('non-ts fence ignored', tsFences('```python\nx=1\n```').length, 0);

// --- type path resolution ----------------------------------------------------
check('types field wins', typePaths({ types: './dist/index.d.ts' })[0], 'dist/index.d.ts');
check('exports["."].types is considered', typePaths({ exports: { '.': { types: './t/i.d.ts' } } })[0], 't/i.d.ts');
check('null exports["."] does not throw', typePaths({ exports: { '.': null } })[0], 'dist/index.d.ts');
check('always has fallbacks', typePaths({}).includes('dist/index.d.ts'), true);

console.log(`  passed: ${passed}`);
console.log(`  failed: ${failures.length}\n`);
if (failures.length > 0) {
  for (const f of failures) console.error(`  FAIL  ${f}`);
  process.exit(1);
}
console.log('import-symbols: all assertions passed');
