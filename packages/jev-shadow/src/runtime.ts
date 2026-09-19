/**
 * The generated plugin copies this one dependency-free module verbatim and pins
 * its byte hash. Keep it free of local imports so another harness can pin the
 * exact same artifact instead of reimplementing the sink.
 */
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath, rm } from 'node:fs/promises';
import { isAbsolute, join, parse, resolve, sep } from 'node:path';

export type EmitResult = Readonly<{ enabled: boolean; appended: boolean; duplicate: boolean; path: string | null }>;
export type ReplayResult = Readonly<{ path: string; rows: readonly Record<string, unknown>[]; malformed: number }>;

const required = ['schema_version', 'namespace', 'producer', 'seam', 'mode', 'decision_id', 'phase',
  'harness', 'session_id', 'prompt_id', 'router', 'jev_pick', 'jev_confidence', 'incumbent_pick',
  'agree', 'floor', 'decided_by', 'unknown_reason'] as const;
const harnesses = new Set(['claude-code', 'codex', 'cursor', 'devin', 'pi', 'agy', 'gemini', 'grok', 'platform']);
const phases = new Set(['pending', 'paired', 'handoff', 'unobserved']);
const decidedBy = new Set(['incumbent', 'jev', 'none', 'unknown']);
const selectedBy = new Set(['jev', 'incumbent', 'none', 'unknown']);
const origins = new Set(['independent', 'not_run', 'unobserved']);
const nullableWithReasons = ['session_id', 'prompt_id', 'router', 'jev_pick', 'jev_confidence', 'floor'];
const optionalNullableStrings = ['incumbent_pick_reason', 'handoff_to', 'tool_call_id', 'incumbent_model', 'candidate_set_sha256', 'selected_pick'];
const allowedKeys = new Set([...required, 'incumbent_pick_reason', ...optionalNullableStrings, 'selected_by', 'incumbent_origin']);
export const JEV_SHADOW_CONTRACT_KEYS = Object.freeze([...allowedKeys].sort());
const segment = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const lockRetryMs = 8;
const lockRetries = 250;

// This is intentionally duplicated as data in contract.ts. The package test
// asserts their canonical hash equality, while this runtime remains one file.
const contractArtifact = {
  schema_version: 1,
  required,
  harnesses: ['claude-code', 'codex', 'cursor', 'devin', 'pi', 'agy', 'gemini', 'grok', 'platform'],
  invariants: [
    'null values require unknown_reason[field]',
    'failed or unobserved incumbent requires agree=null',
    'incumbent_origin=not_run requires incumbent_pick=null and incumbent_pick_reason',
    'selected execution is not an independent incumbent comparison',
  ],
};

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export const JEV_SHADOW_CONTRACT_SHA256 = sha256(JSON.stringify(canonical(contractArtifact)));
export const eventSha256 = (record: Record<string, unknown>): string => sha256(JSON.stringify(canonical(record)));

function nonEmpty(value: unknown): value is string { return typeof value === 'string' && value.length > 0; }
function probability(value: unknown): boolean { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1; }
function reasonMap(value: unknown): value is Record<string, string> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.values(value).every((reason) => nonEmpty(reason));
}
function outcome(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.hasOwn(value, 'choice') && Object.hasOwn(value, 'status') && Object.hasOwn(value, 'reason')
    && (value as Record<string, unknown>).choice === null
    && typeof (value as Record<string, unknown>).status === 'string'
    && ['failed', 'unobserved'].includes((value as Record<string, unknown>).status as string)
    && nonEmpty((value as Record<string, unknown>).reason)
    && Object.keys(value as Record<string, unknown>).every((key) => ['status', 'choice', 'reason'].includes(key));
}

/** Validate every emitted row before any filesystem operation. */
export function validateJevShadow(record: unknown): readonly string[] {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return ['record:not_object'];
  const row = record as Record<string, unknown>, errors: string[] = [];
  for (const key of required) if (!Object.hasOwn(row, key)) errors.push(`missing:${key}`);
  for (const key of Object.keys(row)) if (!allowedKeys.has(key)) errors.push(`unexpected:${key}`);
  if (errors.length) return errors;
  if (row.schema_version !== 1) errors.push('schema_version:not_v1');
  if (!nonEmpty(row.namespace) || !nonEmpty(row.producer) || !nonEmpty(row.seam) || !nonEmpty(row.decision_id)) errors.push('identity:invalid');
  if (row.mode !== 'shadow') errors.push('mode:not_shadow');
  if (typeof row.harness !== 'string' || !harnesses.has(row.harness)) errors.push('harness:unknown');
  if (typeof row.phase !== 'string' || !phases.has(row.phase)) errors.push('phase:invalid');
  if (typeof row.decided_by !== 'string' || !decidedBy.has(row.decided_by)) errors.push('decided_by:invalid');
  if (row.unknown_reason !== null && !reasonMap(row.unknown_reason)) errors.push('unknown_reason:invalid');
  for (const key of nullableWithReasons) {
    const value = row[key];
    if (value === null) {
      if (!reasonMap(row.unknown_reason) || !nonEmpty(row.unknown_reason[key])) errors.push(`unknown_reason:missing:${key}`);
    } else if ((key === 'jev_confidence' || key === 'floor') ? !probability(value) : !nonEmpty(value)) errors.push(`${key}:invalid`);
  }
  if (row.incumbent_pick !== null && !nonEmpty(row.incumbent_pick) && !outcome(row.incumbent_pick)) errors.push('incumbent_pick:invalid');
  if (typeof row.agree !== 'boolean' && row.agree !== null) errors.push('agree:invalid');
  if (outcome(row.incumbent_pick) && row.agree !== null) errors.push('agree:outcome_requires_null');
  if (row.incumbent_pick === null && (!nonEmpty(row.incumbent_pick_reason)
    || !reasonMap(row.unknown_reason) || !nonEmpty(row.unknown_reason.incumbent_pick))) errors.push('incumbent_pick_reason:missing');
  if (row.jev_pick === null && row.agree !== null) errors.push('agree:missing_jev_requires_null');
  if (typeof row.agree === 'boolean' && (!nonEmpty(row.jev_pick) || !nonEmpty(row.incumbent_pick)
    || row.incumbent_origin !== 'independent')) errors.push('agree:requires_independent_choices');
  if (typeof row.agree === 'boolean' && nonEmpty(row.jev_pick) && nonEmpty(row.incumbent_pick)
    && row.agree !== (row.jev_pick === row.incumbent_pick)) errors.push('agree:inconsistent_choices');
  for (const key of optionalNullableStrings) if (row[key] !== undefined && row[key] !== null && !nonEmpty(row[key])) errors.push(`${key}:invalid`);
  if (row.selected_by !== undefined && (typeof row.selected_by !== 'string' || !selectedBy.has(row.selected_by))) errors.push('selected_by:invalid');
  if (row.incumbent_origin !== undefined && (typeof row.incumbent_origin !== 'string' || !origins.has(row.incumbent_origin))) errors.push('incumbent_origin:invalid');
  if (row.incumbent_origin === 'not_run' && row.incumbent_pick !== null) errors.push('incumbent_origin:not_run_requires_null');
  return errors;
}

function safeSegment(value: string, label: string): string {
  if (!segment.test(value) || value === '.' || value === '..') throw new Error(`Unsafe ${label} segment`);
  return value;
}

async function safeDirectory(path: string): Promise<string> {
  if (!isAbsolute(path)) throw new Error('JEV_SHADOW_ROOT must be an absolute path');
  const absolute = resolve(path);
  const parsed = parse(absolute);
  let current = parsed.root;
  for (const part of absolute.slice(parsed.root.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Unsafe JEV_SHADOW_ROOT component: ${current}`);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      try { await mkdir(current, { mode: 0o700 }); } catch (mkdirError: unknown) {
        if ((mkdirError as NodeJS.ErrnoException).code !== 'EEXIST') throw mkdirError;
      }
      const created = await lstat(current);
      if (created.isSymbolicLink() || !created.isDirectory()) throw new Error(`Unsafe JEV_SHADOW_ROOT component: ${current}`);
    }
  }
  const resolved = await realpath(absolute);
  if (resolved !== absolute) throw new Error('JEV_SHADOW_ROOT resolves through a symlink');
  const finalStat = await lstat(absolute);
  if ((finalStat.mode & 0o077) !== 0) throw new Error(`Insecure JEV_SHADOW_ROOT permissions: ${absolute}`);
  return absolute;
}

async function journalPath(root: string, row: Record<string, unknown>): Promise<string> {
  const namespace = safeSegment(String(row.namespace), 'namespace');
  const harness = safeSegment(String(row.harness), 'harness');
  const session = typeof row.session_id === 'string' ? `session-${sha256(row.session_id)}` : 'session-unknown';
  let directory = root;
  for (const part of [namespace, harness, session]) {
    directory = join(directory, part);
    await safeDirectory(directory);
  }
  const journal = join(directory, 'journal.jsonl');
  try {
    const stat = await lstat(journal);
    if (stat.isSymbolicLink() || !stat.isFile() || (stat.mode & 0o077) !== 0) throw new Error(`Unsafe journal: ${journal}`);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return journal;
}

const delay = (milliseconds: number) => new Promise<void>((done) => setTimeout(done, milliseconds));

async function acquireLock(lock: string): Promise<() => Promise<void>> {
  for (let attempt = 0; attempt < lockRetries; attempt++) {
    try {
      const handle = await open(lock, 'wx', 0o600);
      const token = `${process.pid}:${createHash('sha256').update(`${process.pid}:${Date.now()}:${Math.random()}`).digest('hex')}`;
      await handle.writeFile(token, 'utf8');
      await handle.close();
      return async () => {
        let current: string;
        try { current = await readFile(lock, 'utf8'); } catch { return; }
        if (current !== token) throw new Error('Jev shadow lock ownership changed; refusing to remove it');
        await rm(lock, { force: true });
      };
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      let stat;
      try { stat = await lstat(lock); } catch (statError: unknown) {
        if ((statError as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw statError;
      }
      if (stat.isSymbolicLink() || !stat.isFile() || (stat.mode & 0o077) !== 0) throw new Error(`Unsafe journal lock: ${lock}`);
      await delay(lockRetryMs);
    }
  }
  throw new Error('Timed out waiting for Jev shadow journal lock; preserve it for explicit recovery');
}

/**
 * Appends exactly once for an identical canonical row. With no JEV_SHADOW_ROOT
 * there is no directory probing, write, model call, queue, or network action.
 */
export async function emitJevShadow(record: Record<string, unknown>, root = process.env.JEV_SHADOW_ROOT): Promise<EmitResult> {
  if (!root) return { enabled: false, appended: false, duplicate: false, path: null };
  // Freeze the caller-visible input before the first await. A hook wrapper may
  // reuse and mutate its payload object while an async append is in flight.
  const snapshot = JSON.parse(JSON.stringify(record)) as Record<string, unknown>;
  const errors = validateJevShadow(snapshot);
  if (errors.length) throw new Error(`Invalid Jev shadow record: ${errors.join(',')}`);
  const safeRoot = await safeDirectory(root);
  const journal = await journalPath(safeRoot, snapshot);
  const release = await acquireLock(`${journal}.lock`);
  try {
    let fingerprints = new Set<string>();
    let partialSuffix = false;
    try {
      const handle = await open(journal, constants.O_RDONLY | constants.O_NOFOLLOW);
      const prior = await handle.readFile('utf8');
      await handle.close();
      partialSuffix = prior.length > 0 && !prior.endsWith('\n');
      for (const line of prior.split('\n')) {
        if (!line.trim()) continue;
        try {
          const row = JSON.parse(line) as Record<string, unknown>;
          fingerprints.add(eventSha256(row));
        } catch { /* Replay reports malformed lines; never overwrite evidence. */ }
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const fingerprint = eventSha256(snapshot);
    if (fingerprints.has(fingerprint)) return { enabled: true, appended: false, duplicate: true, path: journal };
    const handle = await open(journal, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
    try { await handle.writeFile(`${partialSuffix ? '\n' : ''}${JSON.stringify(snapshot)}\n`, 'utf8'); } finally { await handle.close(); }
    return { enabled: true, appended: true, duplicate: false, path: journal };
  } finally { await release(); }
}

export async function replayJevShadow(path: string): Promise<ReplayResult> {
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || !stat.isFile() || (stat.mode & 0o077) !== 0) throw new Error(`Unsafe journal: ${path}`);
  const rows: Record<string, unknown>[] = [];
  let malformed = 0;
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  const contents = await handle.readFile('utf8');
  await handle.close();
  for (const line of contents.split('\n')) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line) as Record<string, unknown>); } catch { malformed++; }
  }
  return { path, rows, malformed };
}

/** A safe, unknown-only Codex observation. It intentionally excludes hook stdin fields. */
export function createPassiveRecord(input: { namespace: string; producer: string; event: string; session_id?: unknown }): Record<string, unknown> {
  const session = nonEmpty(input.session_id) ? input.session_id : null;
  const event = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse'].includes(input.event) ? input.event : 'Unknown';
  const unknown_reason: Record<string, string> = {
    prompt_id: 'native_prompt_id_unproved', router: 'route_identity_unproved',
    jev_pick: 'zero_credit_no_inference', jev_confidence: 'zero_credit_no_inference', floor: 'no_frozen_floor',
  };
  if (session === null) unknown_reason.session_id = 'session_id_unobserved';
  return {
    schema_version: 1, namespace: input.namespace, producer: input.producer, seam: `codex-passive:${event}`, mode: 'shadow',
    // This is an observation ID, deliberately not a fabricated prompt ID. A
    // repeated opaque hook cannot be proven to be a replay, so preserve it.
    decision_id: `codex-observation:${randomUUID()}`, phase: 'unobserved', harness: 'codex',
    session_id: session, prompt_id: null, router: null, jev_pick: null, jev_confidence: null,
    incumbent_pick: { status: 'unobserved', choice: null, reason: 'codex_hook_payload_unproved' },
    agree: null, floor: null, decided_by: 'unknown', unknown_reason, incumbent_origin: 'unobserved',
    selected_pick: null, selected_by: 'unknown',
  };
}
