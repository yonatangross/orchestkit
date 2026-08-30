/**
 * Cross-Instance Test Validator Hook
 * Hook: Stop (async, asyncRewake)
 * BLOCKING: every implementation file this session wrote must have a test file.
 *
 * #3804: the hook was registered on Stop but read `tool_input.file_path`,
 * which a Stop payload never carries, so it returned silent success on every
 * invocation and its block path could not execute in production (the verdict
 * probe `stop-cross-instance-missing-tests-block` measured `trip=silent`).
 *
 * It is now a real Stop-time check. The set of files to validate comes from
 * `.claude/state/edit-history.jsonl`, which `posttool/write/edit-history-tracker`
 * appends to on every Write/Edit/MultiEdit with the writing session's id, so
 * the read side scopes to THIS session (#2919: concurrent sessions in one
 * project must not see each other's edits). Each file is read from disk at
 * Stop time, not from a payload, and is reported at most once per session
 * (`.claude/state/test-coverage-reported-<sid>.json`) so a finding the
 * operator chose to leave does not re-block every later turn.
 *
 * The legacy single-file shape (`tool_input.file_path` + `content`, the
 * PostToolUse dispatch) is still honoured when present, so the hook can be
 * moved or dual-registered without another rewrite.
 *
 * Test discovery knows three layouts: a sibling `x.test.ts` / `x.spec.ts`, a
 * sibling `__tests__/` dir, and a MIRRORED tree (`src/__tests__/skill/x.test.ts`
 * for `src/skill/x.ts`, which is how this repo lays out its own hook tests).
 * Without the third the hook would have blocked every ork hook author at Stop.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import type { HookInput, HookResult, HookContext } from '../types.js';
import {
  outputSilentSuccess,
  outputBlock,
  outputWarning,
} from '../lib/common.js';
import { NOOP_CTX } from '../lib/context.js';
import { safeIdentifier } from '../lib/safe-fs.js';

const HOOK_NAME = 'cross-instance-test-validator';
const CODE_FILE_RE = /\.(ts|tsx|js|jsx|py)$/;
const JS_FILE_RE = /\.(ts|tsx|js|jsx)$/;
/** Ancestor levels walked when looking for a mirrored test tree. */
const MAX_ANCESTOR_WALK = 8;
/** Files listed in one block message; the rest are counted. */
const MAX_LISTED = 5;

interface EditEntry {
  t: number;
  f: string;
  tool?: string;
  sid?: string;
}

/**
 * Check if file is a test file
 */
function isTestFile(filePath: string): boolean {
  return (
    /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath) ||
    /(^|\/)test_[^/]{0,200}\.py$/.test(filePath) ||
    /_test\.py$/.test(filePath) ||
    /(^|\/)conftest\.py$/.test(filePath)
  );
}

function uniq(items: string[]): string[] {
  return [...new Set(items)];
}

/**
 * Ancestors of `dir`, nearest first, stopping at `projectDir` (inclusive) or
 * after MAX_ANCESTOR_WALK levels. Each item is [ancestor, path-of-dir-relative-to-ancestor].
 */
function ancestorsOf(dir: string, projectDir: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let cur = dir;
  for (let i = 0; i < MAX_ANCESTOR_WALK; i++) {
    out.push([cur, relative(cur, dir)]);
    if (cur === projectDir) break;
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return out;
}

/**
 * Candidate test file paths for an implementation file, most conventional first.
 * Exported for the unit test so the mirrored-tree rule is pinned directly.
 */
export function testFileCandidates(implFile: string, projectDir: string): string[] {
  const dir = dirname(implFile);
  const filename = basename(implFile);
  const stem = filename.replace(/\.[^.]+$/, '');
  const candidates: string[] = [];

  if (JS_FILE_RE.test(implFile)) {
    const ownExt = implFile.split('.').pop() || 'ts';
    const exts = uniq([ownExt, 'ts', 'tsx', 'js', 'jsx']);
    const names = exts.flatMap((e) => [`${stem}.test.${e}`, `${stem}.spec.${e}`]);
    for (const n of names) candidates.push(join(dir, n));
    for (const n of names) candidates.push(join(dir, '__tests__', n));
    for (const [anc, rel] of ancestorsOf(dir, projectDir)) {
      if (!rel) continue; // the sibling __tests__ case is covered above
      for (const root of ['__tests__', 'tests', 'test']) {
        for (const n of names) candidates.push(join(anc, root, rel, n));
      }
    }
  } else if (implFile.endsWith('.py')) {
    const names = [`test_${filename}`, `${stem}_test.py`];
    for (const n of names) candidates.push(join(dir, n));
    for (const n of names) candidates.push(join(dir, 'tests', n));
    for (const [anc, rel] of ancestorsOf(dir, projectDir)) {
      for (const root of ['tests', 'test']) {
        for (const n of names) {
          candidates.push(join(anc, root, rel, n));
          if (rel) candidates.push(join(anc, root, n));
        }
      }
    }
  }

  return uniq(candidates);
}

/**
 * Find corresponding test file for an implementation
 */
function findTestFile(implFile: string, projectDir: string): string | null {
  for (const candidate of testFileCandidates(implFile, projectDir)) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Extract testable units from content
 */
function extractTestableUnits(content: string, filePath: string): string[] {
  const units: string[] = [];

  if (JS_FILE_RE.test(filePath)) {
    // TypeScript/JavaScript: Extract exported functions and classes
    const matches = content.match(/export (function|class|const|async function)\s+([A-Za-z_][A-Za-z0-9_]*)/g);
    if (matches) {
      for (const match of matches) {
        const name = match.split(/\s+/).pop();
        if (name) units.push(name);
      }
    }
  } else if (filePath.endsWith('.py')) {
    // Python: Extract public functions and classes
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^(def|class)\s+([A-Za-z][A-Za-z0-9_]*)/);
      if (match?.[2]) {
        units.push(match[2]);
      }
    }
  }

  return uniq(units);
}

function editHistoryPath(projectDir: string): string {
  return join(projectDir, '.claude', 'state', 'edit-history.jsonl');
}

function reportedPath(projectDir: string, sessionId: string): string {
  const sid = safeIdentifier(sessionId, 'unknown-session');
  return join(projectDir, '.claude', 'state', `test-coverage-reported-${sid}.json`);
}

/**
 * Files this session wrote, per edit-history. Read-only: the tracker owns the
 * file and prompt/thrash-detector owns trimming it. Relative `f` values are
 * resolved against projectDir. Entries without a session id are ignored, as
 * are entries from any other session.
 */
function sessionEditedFiles(projectDir: string, sessionId: string, ctx: HookContext): string[] {
  if (!sessionId) return [];
  const p = editHistoryPath(projectDir);
  if (!existsSync(p)) return [];
  let raw: string;
  try {
    raw = readFileSync(p, 'utf8');
  } catch (err) {
    ctx.log(HOOK_NAME, `edit-history unreadable: ${(err as Error).message}`);
    return [];
  }
  const files: string[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let entry: EditEntry;
    try {
      entry = JSON.parse(line) as EditEntry;
    } catch {
      continue;
    }
    if (!entry || typeof entry.f !== 'string' || !entry.f) continue;
    if (entry.sid !== sessionId) continue;
    files.push(isAbsolute(entry.f) ? entry.f : resolve(projectDir, entry.f));
  }
  return uniq(files);
}

function loadReported(projectDir: string, sessionId: string): Set<string> {
  const p = reportedPath(projectDir, sessionId);
  if (!existsSync(p)) return new Set();
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf8')) as unknown;
    if (Array.isArray(parsed)) return new Set(parsed.filter((x): x is string => typeof x === 'string'));
  } catch {
    // corrupt marker file: treat as nothing reported yet
  }
  return new Set();
}

function saveReported(projectDir: string, sessionId: string, reported: Set<string>, ctx: HookContext): void {
  const p = reportedPath(projectDir, sessionId);
  try {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify([...reported]), 'utf8');
  } catch (err) {
    ctx.log(HOOK_NAME, `reported-set write failed: ${(err as Error).message}`);
  }
}

interface FileFinding {
  filePath: string;
  units: string[];
  testFile: string | null;
  untested: string[];
}

function inspectFile(filePath: string, content: string, projectDir: string): FileFinding | null {
  const units = extractTestableUnits(content, filePath);
  if (units.length === 0) return null;
  const testFile = findTestFile(filePath, projectDir);
  let untested: string[] = [];
  if (testFile) {
    try {
      const testContent = readFileSync(testFile, 'utf8');
      untested = units.filter((unit) => {
        const regex = new RegExp(`\\b${unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        return !regex.test(testContent);
      });
    } catch {
      // unreadable test file: count as present, do not invent gaps
    }
  }
  return { filePath, units, testFile, untested };
}

function expectedTestLocations(filePath: string): string[] {
  const dir = dirname(filePath);
  const fname = basename(filePath);
  if (JS_FILE_RE.test(filePath)) {
    const base = filePath.replace(/\.[^.]+$/, '');
    const ext = filePath.split('.').pop() || 'ts';
    return [`${base}.test.${ext}`, `${dir}/__tests__/${fname}`];
  }
  return [`${dir}/test_${fname}`, `${dirname(dir)}/tests/test_${fname}`];
}

function formatMissing(findings: FileFinding[]): string {
  const lines: string[] = [];
  const shown = findings.slice(0, MAX_LISTED);
  for (const f of shown) {
    lines.push(`  Implementation: ${f.filePath}`);
    lines.push('  Expected test file:');
    for (const loc of expectedTestLocations(f.filePath)) lines.push(`    - ${loc}`);
    lines.push(`  Found ${f.units.length} testable units:`);
    for (const unit of f.units.slice(0, MAX_LISTED)) lines.push(`    - ${unit}`);
  }
  if (findings.length > shown.length) {
    lines.push(`  ...and ${findings.length - shown.length} more file(s) without a test file`);
  }
  return lines.join('\n');
}

function formatGaps(findings: FileFinding[]): string {
  const lines: string[] = ['TEST COVERAGE: New units without tests'];
  for (const f of findings.slice(0, MAX_LISTED)) {
    lines.push(`  Implementation: ${f.filePath}`);
    lines.push(`  Test file: ${f.testFile}`);
    lines.push(`  Untested units (${f.untested.length}/${f.units.length}):`);
    for (const unit of f.untested.slice(0, MAX_LISTED)) lines.push(`    - ${unit}`);
  }
  lines.push('  Add tests before committing');
  return lines.join('\n');
}

/**
 * Validate test coverage for the files this session wrote (Stop), or for one
 * file when dispatched with a Write/Edit payload.
 */
export function crossInstanceTestValidator(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  // Stop re-entry guard: CC sets this when a Stop hook already blocked once in
  // this stop cycle. Blocking again is the CC 2.1.78 infinite-loop shape.
  if (input.stop_hook_active) return outputSilentSuccess();

  const projectDir = input.project_dir || ctx.projectDir;
  const sessionId = input.session_id || ctx.sessionId || '';

  // Legacy single-file shape (PostToolUse dispatch): validate that one file.
  const payloadPath = input.tool_input?.file_path || '';
  if (payloadPath) {
    if (isTestFile(payloadPath) || !CODE_FILE_RE.test(payloadPath)) return outputSilentSuccess();
    let content = input.tool_input?.content || '';
    if (!content) {
      try {
        content = readFileSync(payloadPath, 'utf8');
      } catch {
        return outputSilentSuccess();
      }
    }
    const finding = inspectFile(payloadPath, content, projectDir);
    if (!finding) return outputSilentSuccess();
    if (!finding.testFile) {
      return outputBlock(`Missing test coverage for new code: TEST COVERAGE: No test file found for implementation\n${formatMissing([finding])}`);
    }
    if (finding.untested.length > 0) return outputWarning(formatGaps([finding]));
    return outputSilentSuccess();
  }

  // Stop shape: the session's written files come from edit-history.
  const files = sessionEditedFiles(projectDir, sessionId, ctx);
  if (files.length === 0) return outputSilentSuccess();

  const reported = loadReported(projectDir, sessionId);
  const missing: FileFinding[] = [];
  const gaps: FileFinding[] = [];
  let newlyReported = 0;

  for (const filePath of files) {
    if (reported.has(filePath)) continue;
    if (isTestFile(filePath) || !CODE_FILE_RE.test(filePath)) continue;
    if (!existsSync(filePath)) continue; // written, then deleted
    let content: string;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    const finding = inspectFile(filePath, content, projectDir);
    if (!finding) continue;
    if (!finding.testFile) {
      missing.push(finding);
    } else if (finding.untested.length > 0) {
      gaps.push(finding);
    } else {
      continue; // fully covered: nothing to report, nothing to remember
    }
    reported.add(filePath);
    newlyReported++;
  }

  if (newlyReported > 0) saveReported(projectDir, sessionId, reported, ctx);

  if (missing.length > 0) {
    ctx.log(HOOK_NAME, `${missing.length} implementation file(s) without a test file at Stop`);
    return outputBlock(`Missing test coverage for new code: TEST COVERAGE: No test file found for implementation\n${formatMissing(missing)}`);
  }
  if (gaps.length > 0) {
    return outputWarning(formatGaps(gaps));
  }
  return outputSilentSuccess();
}
