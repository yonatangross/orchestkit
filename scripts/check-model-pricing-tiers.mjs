#!/usr/bin/env node
/**
 * Pin models.vocab.json pricing to the price table baked into the CC binary.
 *
 * WHY. `lib/models.vocab.json` carries a per-model price table that
 * `cost-estimator.ts` uses for every cost figure, while Claude Code prices
 * the same models from a catalog compiled into its binary. Nothing outside
 * the binary prints that catalog (no subcommand, no file; the managed
 * `modelPricing` setting is an enterprise override, not a source), so the
 * vocab was a second source of truth with no check between them (#3878).
 *
 * WHAT. The binary carries, as literals, a tier table and a model catalog:
 *   pricing_tiers:{tier_3_15:{input:3,output:15,cache_write_5m:3.75,
 *                  cache_write_1h:6,cache_read:0.3,web_search:0.01},
 *                  haiku_45:{input:1,output:5,...},...}
 *   {id:"claude-fable-5-1",...,provider_ids:{first_party:"..."},...,
 *    pricing:"tier_10_50_cache_read_0_25",...}
 * (8 tiers and 19 catalog rows on 2.1.258). Tier names are opaque labels
 * (`haiku_45` sits beside `tier_10_50_cache_read_0_25`), so this script never
 * decodes a name: it reads the tier's numbers from the table and compares
 * them with the vocab's four (input, output, cache_read, cache_write, where
 * the vocab's cache_write is the 5-minute write).
 *
 * VERDICTS (exit code), in the shape of scripts/derive-cc-output-keys.mjs:
 *   0 OK               every priced vocab model with a catalog row matches
 *   1 DRIFT            a vocab row disagrees with the binary; fix the vocab
 *   2 CANNOT-OBSERVE   no binary, or no tier table / catalog rows parsed
 *   3 UNKNOWN-TIER     a catalog row names a tier the table does not define;
 *                      the layout is CC's private format, so that must be
 *                      loud, never silently skipped
 *
 * Usage:
 *   node scripts/check-model-pricing-tiers.mjs           print the comparison
 *   node scripts/check-model-pricing-tiers.mjs --check   same, exit non-zero on 1/2/3
 *
 * Reads only. The binary lookup mirrors derive-cc-output-keys.mjs (native
 * installer versions dir first, then PATH with symlinks resolved).
 */
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VOCAB_PATH = join(ROOT, 'src/hooks/src/lib/models.vocab.json');
const CHECK = process.argv.includes('--check');
const EPS = 1e-6;

function findBinary() {
  return binaryFromVersionsDir() ?? binaryFromPath();
}

function binaryFromVersionsDir() {
  const versions = join(homedir(), '.local/share/claude/versions');
  if (!existsSync(versions)) return null;
  const candidates = readdirSync(versions)
    .filter((n) => /^\d+\.\d+\.\d+$/.test(n))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  if (candidates.length === 0) return null;
  const newest = join(versions, candidates[candidates.length - 1]);
  return statSync(newest).isFile() ? { path: newest, version: candidates[candidates.length - 1] } : null;
}

function binaryFromPath() {
  for (const dir of (process.env.PATH || '').split(delimiter).filter(Boolean)) {
    const candidate = join(dir, 'claude');
    if (!existsSync(candidate)) continue;
    try {
      const real = realpathSync(candidate);
      if (!statSync(real).isFile()) continue;
      const m = real.match(/\/versions\/(\d+\.\d+\.\d+)$/);
      return { path: real, version: m ? m[1] : 'unknown' };
    } catch {
      continue; // silent: known-noise (broken symlink or unreadable entry on PATH; keep looking)
    }
  }
  return null;
}

/** The `pricing_tiers:{name:{input,output,cache_write_5m,cache_write_1h,cache_read,...},...}` table. */
export function pricingTiers(buf) {
  const tiers = new Map();
  const needle = Buffer.from('pricing_tiers:{');
  const start = buf.indexOf(needle);
  if (start === -1) return tiers;
  const text = buf.subarray(start, start + 4000).toString('latin1');
  // The table ends at the first `}}` (last tier's closing brace + the table's own).
  const end = text.indexOf('}}');
  const body = end === -1 ? text : text.slice(0, end + 1);
  const re = /([A-Za-z0-9_]+):\{input:([\d.]+),output:([\d.]+),cache_write_5m:([\d.]+),cache_write_1h:([\d.]+),cache_read:([\d.]+)/g;
  for (const m of body.matchAll(re)) {
    tiers.set(m[1], {
      input: Number(m[2]),
      output: Number(m[3]),
      cacheWrite5m: Number(m[4]),
      cacheWrite1h: Number(m[5]),
      cacheRead: Number(m[6]),
    });
  }
  return tiers;
}

/** Every `{id:"claude-…"` catalog row that carries a pricing tier name. */
export function catalogRows(buf) {
  const rows = new Map();
  const needle = Buffer.from('{id:"claude-');
  let pos = 0;
  while ((pos = buf.indexOf(needle, pos)) !== -1) {
    const slice = buf.subarray(pos, pos + 2000).toString('latin1');
    const next = slice.indexOf('{id:"', 5);
    const row = next === -1 ? slice : slice.slice(0, next);
    const id = /^\{id:"([^"]+)"/.exec(row)?.[1];
    const tier = /pricing:"([^"]+)"/.exec(row)?.[1];
    const firstParty = /first_party:"([^"]+)"/.exec(row)?.[1] ?? null;
    if (id && tier && !rows.has(id)) rows.set(id, { tier, firstParty });
    pos += needle.length;
  }
  return rows;
}

function near(a, b) {
  return Math.abs(a - b) < EPS;
}

function main() {
  const bin = findBinary();
  if (!bin) {
    console.log('CANNOT-OBSERVE: no claude binary found (versions dir or PATH).');
    return 2;
  }
  const buf = readFileSync(bin.path);
  const tiers = pricingTiers(buf);
  const rows = catalogRows(buf);
  console.log(`binary: ${bin.path} (${bin.version}), ${buf.length} bytes, ${tiers.size} pricing tiers, ${rows.size} priced catalog rows`);
  if (tiers.size === 0 || rows.size === 0) {
    console.log('CANNOT-OBSERVE: the `pricing_tiers:{…}` table or the `{id:"claude-…",…pricing:"…"}` rows were not found; the catalog layout changed.');
    return 2;
  }
  console.log(`tiers: ${[...tiers.keys()].join(', ')}`);

  const byFirstParty = new Map();
  for (const [id, r] of rows) if (r.firstParty) byFirstParty.set(r.firstParty, id);

  const vocab = JSON.parse(readFileSync(VOCAB_PATH, 'utf8'));
  const pricing = vocab.pricing ?? {};
  let drift = 0;
  let unknown = 0;
  const lines = ['| vocab model | catalog row | tier | verdict |', '|---|---|---|---|'];
  for (const [model, p] of Object.entries(pricing)) {
    const rowId = rows.has(model) ? model : byFirstParty.get(model);
    if (!rowId) {
      lines.push(`| ${model} | (none) | | not in catalog, vocab unverified |`);
      continue;
    }
    const { tier } = rows.get(rowId);
    const t = tiers.get(tier);
    if (!t) {
      unknown += 1;
      lines.push(`| ${model} | ${rowId} | ${tier} | UNKNOWN-TIER (not in the pricing_tiers table) |`);
      continue;
    }
    const diffs = [];
    if (!near(t.input, p.input_per_mtok)) diffs.push(`input ${p.input_per_mtok} vs ${t.input}`);
    if (!near(t.output, p.output_per_mtok)) diffs.push(`output ${p.output_per_mtok} vs ${t.output}`);
    if (!near(t.cacheRead, p.cache_read_per_mtok)) diffs.push(`cache_read ${p.cache_read_per_mtok} vs ${t.cacheRead}`);
    if (!near(t.cacheWrite5m, p.cache_write_per_mtok)) diffs.push(`cache_write ${p.cache_write_per_mtok} vs ${t.cacheWrite5m}`);
    if (diffs.length) {
      drift += 1;
      lines.push(`| ${model} | ${rowId} | ${tier} | DRIFT: ${diffs.join('; ')} |`);
    } else {
      lines.push(`| ${model} | ${rowId} | ${tier} | ok |`);
    }
  }
  console.log(lines.join('\n'));

  const unpriced = [...rows.keys()].filter((id) => !pricing[id] && !pricing[rows.get(id).firstParty ?? '']);
  if (unpriced.length) console.log(`\ncatalog rows with no vocab price (informational): ${unpriced.join(', ')}`);

  if (unknown) {
    console.log(`\nUNKNOWN-TIER: ${unknown} catalog row(s) name a tier the pricing_tiers table does not define; read the binary before changing anything.`);
    return 3;
  }
  if (drift) {
    console.log(`\nDRIFT: ${drift} vocab row(s) disagree with the binary; update src/hooks/src/lib/models.vocab.json.`);
    return 1;
  }
  console.log('\nOK: every priced vocab model with a catalog row matches its tier.');
  return 0;
}

const rc = main();
process.exit(CHECK ? rc : 0);
