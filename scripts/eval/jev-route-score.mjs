#!/usr/bin/env node
/**
 * Offline scorer for the Jev routing seam (#4233).
 *
 * Reads scripts/eval/jev-route-cases.jsonl (150 masked gold rows: id, prompt,
 * gold) and scores a verdict per row against the gold class:
 *
 *   --records <jev-route.jsonl>   replay from seam records. A record carries no
 *                                 prompt text, only input_sha256 of the redacted
 *                                 prompt, so each case is redacted the same way
 *                                 and joined on that hash.
 *   --clients a,b | --clients-dir <dir>
 *                                 client names the records were redacted with;
 *                                 a replay whose records carry another
 *                                 redaction profile, or mix profiles, is refused.
 *   (no --records)                call the seam live. Needs ORK_TYPESAFE_API_KEY;
 *                                 forces ORK_ROUTE_JEV=shadow and writes no
 *                                 session record. Spend: about USD 0.06 per
 *                                 1,000 rows at the measured 1,4xx input tokens.
 *
 * Prints accuracy overall and per class, plus the misses. Never prints prompt
 * text; ids and labels only. Exit 0 always (a report, not a gate).
 *
 * Needs the hooks bundle: `cd src/hooks && npm run build` (dist is release-owned
 * and not committed on feature branches).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, '..', '..');
const CASES_PATH = join(SCRIPT_DIR, 'jev-route-cases.jsonl');
const BUNDLE = join(ROOT, 'src', 'hooks', 'dist', 'prompt.mjs');

const log = (s = '') => process.stdout.write(`${s}\n`);

function readJsonl(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

async function loadSeam() {
  if (!existsSync(BUNDLE)) {
    log(`ERROR: hooks bundle missing at ${BUNDLE}. Run: cd src/hooks && npm run build`);
    process.exit(2);
  }
  const mod = await import(pathToFileURL(BUNDLE).href);
  for (const name of ['routeJudgment', 'redactPrompt', 'sha256', 'resolveRouteConfig', 'joinReplayRecords', 'readClientNamesIn']) {
    if (typeof mod[name] !== 'function') {
      log(`ERROR: bundle does not export ${name}; rebuild src/hooks`);
      process.exit(2);
    }
  }
  return mod;
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

/**
 * Client names the replay redacts with (#4239), so a record whose prompt
 * carried a client token joins: `--clients a,b` or `--clients-dir <dir>`
 * (the directory names inside it, as production reads <projectDir>/clients/).
 */
function replayClientNames(seam) {
  const list = argValue('--clients');
  const dir = argValue('--clients-dir');
  if (list !== null && dir !== null) {
    log('ERROR: pass --clients or --clients-dir, not both');
    process.exit(2);
  }
  if (dir !== null) return seam.readClientNamesIn(dir);
  if (list !== null) return list.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

async function main() {
  const seam = await loadSeam();
  const cases = readJsonl(CASES_PATH);
  const recordsPath = argValue('--records');
  const limit = Number(argValue('--limit') || cases.length);
  const config = seam.resolveRouteConfig({});

  /** @type {Map<string, {intent: string|null, conf: number|null, decided_by: string, latency_ms: number, input_tokens: number|null}>} */
  const verdicts = new Map();
  if (recordsPath) {
    const records = readJsonl(recordsPath);
    const joined = seam.joinReplayRecords(
      records,
      cases.map((c) => ({ id: c.id, text: c.prompt })),
      { clientNames: replayClientNames(seam), maxPromptChars: config.maxPromptChars },
    );
    if (joined.error) {
      log(`ERROR: ${joined.error}`);
      process.exit(2);
    }
    for (const [id, r] of joined.verdicts) verdicts.set(id, r);
    log(`records: ${records.length} loaded from ${recordsPath}, ${verdicts.size} of ${cases.length} cases matched by sha (redaction profile ${joined.profile})`);
  } else {
    if (!process.env.ORK_TYPESAFE_API_KEY) {
      log('ERROR: no --records and ORK_TYPESAFE_API_KEY is unset; nothing to score');
      process.exit(2);
    }
    const env = { ...process.env, ORK_ROUTE_JEV: 'shadow' };
    let n = 0;
    for (const c of cases.slice(0, limit)) {
      const v = await seam.routeJudgment({
        prompt: c.prompt,
        sessionId: 'jev-route-score',
        projectDir: ROOT,
        env,
        clientNames: [],
        record: false,
      });
      verdicts.set(c.id, v);
      n += 1;
      if (n % 25 === 0) log(`  ${n}/${Math.min(limit, cases.length)}`);
    }
  }

  const perClass = {};
  const misses = [];
  let correct = 0;
  let scored = 0;
  let latency = [];
  let tokens = 0;
  for (const c of cases.slice(0, limit)) {
    const v = verdicts.get(c.id);
    const bucket = (perClass[c.gold] ||= { correct: 0, total: 0 });
    bucket.total += 1;
    if (!v) continue;
    scored += 1;
    if (typeof v.latency_ms === 'number') latency.push(v.latency_ms);
    if (typeof v.input_tokens === 'number') tokens += v.input_tokens;
    if (v.intent === c.gold) {
      correct += 1;
      bucket.correct += 1;
    } else {
      misses.push({ id: c.id, gold: c.gold, got: v.intent, conf: v.conf, decided_by: v.decided_by });
    }
  }
  latency = latency.sort((a, b) => a - b);
  const p = (q) => (latency.length ? latency[Math.min(latency.length - 1, Math.floor(q * latency.length))] : null);

  log('Jev routing seam, offline score against gold');
  log('='.repeat(60));
  for (const cls of Object.keys(perClass).sort()) {
    const b = perClass[cls];
    log(`  ${cls.padEnd(20)} ${String(b.correct).padStart(3)}/${String(b.total).padEnd(3)} ${((100 * b.correct) / b.total).toFixed(0)}%`);
  }
  log('');
  log(`Scored : ${scored}/${Math.min(limit, cases.length)} cases had a verdict`);
  log(`Correct: ${correct}/${scored} = ${scored ? ((100 * correct) / scored).toFixed(1) : '0.0'}%`);
  if (latency.length) log(`Latency: p50 ${p(0.5)} ms, p95 ${p(0.95)} ms over ${latency.length} calls`);
  if (tokens) log(`Tokens : ${tokens} input, USD ${((tokens * 0.042) / 1e6).toFixed(4)} at 0.042 per M`);
  if (misses.length) {
    log('');
    log('Misses (id, gold, got, conf, decided_by):');
    for (const m of misses) log(`  ${m.id} ${m.gold} ${m.got} ${m.conf ?? 'na'} ${m.decided_by}`);
  }
}

main().catch((e) => {
  log(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(2);
});
