// scripts/lib/import-symbols.mjs — pure extraction/parsing for the import-symbol gate.
//
// Split out of check-import-symbols.mjs so these can be unit-tested offline. The CLI does a
// network sweep at module load, so it cannot be imported by a test; these functions can.
//
// Every function here is pure: string in, data out. No fs, no network.

const NODE_BUILTINS = new Set([
  'fs', 'path', 'url', 'crypto', 'http', 'https', 'os', 'util', 'events', 'stream',
  'child_process', 'assert', 'zlib', 'buffer', 'process', 'readline', 'worker_threads',
]);

/** Every ```ts / ```typescript / ```tsx fence body in a markdown file. */
export function tsFences(md) {
  const out = [];
  const re = /```(?:ts|typescript|tsx)\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(md)) !== null) out.push(m[1]);
  return out;
}

/**
 * Named imports only: `import { A, B as C, type D } from "pkg"`.
 * Default and namespace imports are deliberately out of scope — `import X from "pkg"` binds
 * whatever the default is and cannot be falsified from an export list.
 */
export function namedImports(code) {
  const out = [];
  const re = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const symbols = m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim())
      .filter((s) => /^[A-Za-z_$][\w$]*$/.test(s));
    if (symbols.length > 0) out.push({ spec: m[2], symbols });
  }
  return out;
}

/** "@scope/pkg/sub" -> {kind:'package', root:"@scope/pkg", subpath:"sub"} */
export function splitSpecifier(spec) {
  if (spec.startsWith('.') || spec.startsWith('/')) return { kind: 'relative' };
  if (spec.startsWith('node:')) return { kind: 'builtin' };
  // `@/components`, `@/lib`, ... are the conventional TS path alias for project-internal code.
  // They are NOT packages: counting them as "unmapped" inflates the skip bucket and hides how
  // much real coverage is missing.
  if (spec.startsWith('@/')) return { kind: 'relative' };
  const parts = spec.split('/');
  const root = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  if (NODE_BUILTINS.has(root)) return { kind: 'builtin' };
  const subpath = spec.slice(root.length).replace(/^\//, '');
  return { kind: 'package', root, subpath };
}

/**
 * Export names declared by a .d.ts.
 * Returns { names:Set, selfContained:boolean }. `export *` means the list is NOT self-contained,
 * so a missing name proves nothing and the package must be skipped rather than reported.
 */
export function parseExports(dts) {
  const names = new Set();
  // Must match BOTH `export { A, B }` and `export type { A, B }`. Missing the type-only form
  // makes every symbol in such a block invisible, so a doc importing one is falsely reported as
  // "not exported" — a false positive, which is the failure mode that gets a gate muted.
  // Found by adversarial verification against vitest@4.1.10, whose d.ts ends with
  // `export type { AssertType, BrowserUI, ... }`.
  const listRe = /export\s*(?:type\s*)?\{([^}]*)\}/g;
  let m;
  while ((m = listRe.exec(dts)) !== null) {
    for (const raw of m[1].split(',')) {
      const s = raw.trim().replace(/^type\s+/, '');
      if (!s) continue;
      const parts = s.split(/\s+as\s+/);
      const exported = (parts[1] ?? parts[0]).trim();
      if (/^[A-Za-z_$][\w$]*$/.test(exported)) names.add(exported);
    }
  }
  const declRe = /export\s+(?:declare\s+)?(?:abstract\s+)?(?:class|function|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  while ((m = declRe.exec(dts)) !== null) names.add(m[1]);
  const selfContained = !/export\s+\*\s+from/.test(dts);
  return { names, selfContained };
}

/** Candidate .d.ts paths for a package manifest, most authoritative first. */
export function typePaths(manifest) {
  const out = [];
  const t = manifest?.types ?? manifest?.typings;
  if (typeof t === 'string') out.push(t.replace(/^\.\//, ''));
  const dot = manifest?.exports?.['.'];
  const fromExports =
    typeof dot === 'object' && dot !== null
      ? (dot.types ?? dot.import?.types ?? dot.default?.types)
      : null;
  if (typeof fromExports === 'string') out.push(fromExports.replace(/^\.\//, ''));
  out.push('dist/index.d.ts', 'index.d.ts', 'dist/index.d.mts');
  return [...new Set(out)];
}
