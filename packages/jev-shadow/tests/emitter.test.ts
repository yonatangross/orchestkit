import { execFile } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { createPassiveRecord, emitJevShadow, eventSha256, JEV_SHADOW_CONTRACT_KEYS, replayJevShadow, validateJevShadow } from '../src/runtime.js';
import { JEV_SHADOW_CONTRACT_ARTIFACT, JEV_SHADOW_REQUIRED_KEYS } from '../src/contract.js';

const exec = promisify(execFile);
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(async (root) => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }))); });

const fixtureBase = '/private/tmp/sc33/jev-foundation-fixtures';
const root = async () => { await mkdir(fixtureBase, { recursive: true }); const value = await mkdtemp(join(fixtureBase, 'jev-shadow-')); roots.push(value); return value; };
const row = (extra: Record<string, unknown> = {}) => ({
  schema_version: 1, namespace: 'host_a', producer: 'ork-codex', seam: 'codex-passive', mode: 'shadow',
  decision_id: 'decision-a', phase: 'unobserved', harness: 'codex', session_id: 'session-a', prompt_id: null,
  router: null, jev_pick: null, jev_confidence: null,
  incumbent_pick: { status: 'unobserved', choice: null, reason: 'payload_unproved' }, agree: null, floor: null,
  decided_by: 'unknown', unknown_reason: { prompt_id: 'unproved', router: 'unproved', jev_pick: 'zero_credit_no_inference',
    jev_confidence: 'zero_credit_no_inference', floor: 'no_floor' }, incumbent_origin: 'unobserved',
  selected_pick: null, selected_by: 'unknown', ...extra,
});

describe('Jev shadow contract', () => {
  it('requires every canonical key and reasons every nullable unknown', () => {
    const good = row();
    expect(validateJevShadow(good)).toEqual([]);
    for (const key of JEV_SHADOW_REQUIRED_KEYS) {
      const mutated = { ...good } as Record<string, unknown>;
      delete mutated[key];
      expect(validateJevShadow(mutated)).toContain(`missing:${key}`);
    }
    expect(validateJevShadow(row({ unknown_reason: { prompt_id: 'only' } }))).toContain('unknown_reason:missing:router');
    expect(validateJevShadow({ ...good, forbidden: true })).toContain('unexpected:forbidden');
    expect(validateJevShadow({ ...good, harness: ['codex'] })).toContain('harness:unknown');
    expect(validateJevShadow({ ...good, selected_pick: 4 })).toContain('selected_pick:invalid');
    expect(validateJevShadow({ ...good, candidate_set_sha256: 8 })).toContain('candidate_set_sha256:invalid');
    expect(validateJevShadow({ ...good, incumbent_pick_reason: 7 })).toContain('incumbent_pick_reason:invalid');
    expect(validateJevShadow({ ...good, incumbent_pick: { status: ['failed'], choice: null, reason: 'bad' } })).toContain('incumbent_pick:invalid');
    expect(validateJevShadow({ ...good, jev_pick: 'a', incumbent_pick: 'b', agree: true, incumbent_origin: 'unobserved' })).toContain('agree:requires_independent_choices');
    expect(validateJevShadow({ ...good, jev_pick: 'a', incumbent_pick: 'a', agree: true, incumbent_origin: 'independent', selected_pick: 'a', selected_by: 'jev' })).toEqual([]);
    expect(validateJevShadow({ ...good, jev_pick: 'a', incumbent_pick: 'b', agree: true, incumbent_origin: 'independent' })).toContain('agree:inconsistent_choices');
    expect(validateJevShadow(Object.create(good))).toContain('missing:schema_version');
    expect(validateJevShadow({ ...good, incumbent_pick: Object.assign(Object.create({ status: 'failed' }), { choice: null, reason: 'inherited' }) })).toContain('incumbent_pick:invalid');
    expect(validateJevShadow(row({ incumbent_pick: { status: 'failed', choice: null, reason: 'timeout' }, agree: false }))).toContain('agree:outcome_requires_null');
    expect(validateJevShadow(row({ incumbent_pick: null, incumbent_pick_reason: null }))).toContain('incumbent_pick_reason:missing');
    expect(validateJevShadow(row({ jev_pick: null, agree: true }))).toContain('agree:missing_jev_requires_null');
    expect(JEV_SHADOW_CONTRACT_ARTIFACT.required).toEqual(JEV_SHADOW_REQUIRED_KEYS);
  });

  it('keeps the runtime contract aligned with the immutable all-harness schema fixture', async () => {
    const schema = JSON.parse(await readFile(new URL('../fixtures/jev-allharness-contract.schema.json', import.meta.url), 'utf8'));
    expect(schema.required).toEqual(JEV_SHADOW_REQUIRED_KEYS);
    expect(Object.keys(schema.properties).sort()).toEqual(JEV_SHADOW_CONTRACT_KEYS);
    expect(schema.properties.harness.enum).toEqual(JEV_SHADOW_CONTRACT_ARTIFACT.harnesses);
    expect(schema.properties.mode.const).toBe('shadow');
  });

  it('does zero filesystem work and no network work while root is absent', async () => {
    const disabled = await emitJevShadow(row(), undefined);
    expect(disabled).toEqual({ enabled: false, appended: false, duplicate: false, path: null });
  });

  it('serializes, deduplicates, and replays malformed evidence without overwriting it', async () => {
    const destination = await root();
    const results = await Promise.all(Array.from({ length: 24 }, () => emitJevShadow(row(), destination)));
    expect(results.filter((result) => result.appended)).toHaveLength(1);
    expect(results.filter((result) => result.duplicate)).toHaveLength(23);
    const journal = results[0]?.path;
    expect(journal).toBeTruthy();
    await writeFile(journal!, '{malformed', { flag: 'a' });
    expect((await emitJevShadow(row({ decision_id: 'after-partial' }), destination)).appended).toBe(true);
    const replay = await replayJevShadow(journal!);
    expect(replay.rows).toHaveLength(2);
    expect(eventSha256(replay.rows[0]!)).toBe(eventSha256(row()));
    expect(replay.malformed).toBe(1);
  });

  it('rejects traversal and symlink escapes', async () => {
    const destination = await root();
    await expect(emitJevShadow(row({ namespace: '../escape' }), destination)).rejects.toThrow('Unsafe namespace segment');
    const outside = await root();
    const link = join(destination, 'linked');
    await symlink(outside, link);
    await expect(emitJevShadow(row(), link)).rejects.toThrow('Unsafe JEV_SHADOW_ROOT component');
  });

  it('rejects group-readable roots and existing journals', async () => {
    const destination = await root();
    await chmod(destination, 0o755);
    await expect(emitJevShadow(row(), destination)).rejects.toThrow('Insecure JEV_SHADOW_ROOT permissions');
    await chmod(destination, 0o700);
    const emitted = await emitJevShadow(row(), destination);
    await chmod(emitted.path!, 0o644);
    await expect(emitJevShadow(row({ decision_id: 'insecure-journal' }), destination)).rejects.toThrow('Unsafe journal');
  });

  it('fails closed for an orphaned lock and preserves it for manual offline recovery', async () => {
    const destination = await root();
    const first = await emitJevShadow(row(), destination);
    const lock = `${first.path}.lock`;
    await writeFile(lock, '999999:dead');
    await expect(emitJevShadow(row({ decision_id: 'after-restart' }), destination)).rejects.toThrow('Unsafe journal lock');
  });

  it('keeps overlapping, handoff, retry, failed, and unobserved rows distinct', async () => {
    const destination = await root();
    const handoff = row({ decision_id: 'handoff', phase: 'handoff', router: 'hq-ext:auto', handoff_to: 'ork:auto',
      prompt_id: 'prompt-a', unknown_reason: { jev_pick: 'zero_credit_no_inference', jev_confidence: 'zero_credit_no_inference', floor: 'no_floor' } });
    const failed = row({ decision_id: 'failed', phase: 'paired', prompt_id: 'prompt-a', router: 'ork:auto',
      incumbent_pick: { status: 'failed', choice: null, reason: 'timeout' }, unknown_reason: { jev_pick: 'zero_credit_no_inference', jev_confidence: 'zero_credit_no_inference', floor: 'no_floor' } });
    const retry = row({ decision_id: 'retry', session_id: 'session-b' });
    await Promise.all([emitJevShadow(handoff, destination), emitJevShadow(failed, destination), emitJevShadow(retry, destination)]);
    const path = (await emitJevShadow(row(), destination)).path!;
    const replay = await replayJevShadow(path);
    expect(replay.rows.map((item) => item.decision_id)).toContain('handoff');
    expect(replay.rows.map((item) => item.decision_id)).toContain('failed');
    expect(replay.rows.map((item) => item.agree).filter((item) => item === null)).toHaveLength(3);
  });

  it('accepts cross-process appends without loss or duplicate records', async () => {
    const destination = await root();
    const runtime = new URL('../dist/esm/runtime.js', import.meta.url).pathname;
    const script = `import { emitJevShadow } from ${JSON.stringify(`file://${runtime}`)}; const i = process.argv[1]; await emitJevShadow(${JSON.stringify(row())}, process.env.JEV_SHADOW_ROOT);`;
    await Promise.all(Array.from({ length: 12 }, (_, i) => exec(process.execPath, ['--input-type=module', '--eval', script, String(i)], { env: { ...process.env, JEV_SHADOW_ROOT: destination } })));
    const journal = join(destination, 'host_a', 'codex');
    const child = (await import('node:fs/promises')).readdir(journal, { recursive: true });
    const names = await child;
    const file = names.find((name) => name.endsWith('journal.jsonl'))!;
    const contents = await readFile(join(journal, file), 'utf8');
    expect(contents.trim().split('\n')).toHaveLength(1);
  });

  it('never carries raw hook input in the Codex passive record', () => {
    const passive = createPassiveRecord({ namespace: 'host_a', producer: 'ork-codex', event: 'PreToolUse', session_id: 'session-a' });
    expect(validateJevShadow(passive)).toEqual([]);
    expect(Object.keys(passive)).not.toEqual(expect.arrayContaining(['tool_input', 'tool_response', 'prompt', 'model']));
    expect(passive.prompt_id).toBeNull();
    expect(passive.seam).toBe('codex-passive:PreToolUse');
    expect(passive.incumbent_pick).toEqual({ status: 'unobserved', choice: null, reason: 'codex_hook_payload_unproved' });
  });

  it('performs an affirmative enabled append without a network primitive', async () => {
    const destination = await root();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => { throw new Error('network forbidden'); }) as typeof fetch;
    try { expect((await emitJevShadow(row({ decision_id: 'enabled-no-network' }), destination)).appended).toBe(true); }
    finally { globalThis.fetch = originalFetch; }
  });
});
