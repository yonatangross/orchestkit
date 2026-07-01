#!/usr/bin/env node
/**
 * Phase-0 routing-accuracy PR gate for /ork:auto.
 *
 * Loads src/skills/auto/routing-benchmark.json (labeled goal->category pairs),
 * runs a DETERMINISTIC rule-based classifier that mirrors the disambiguation
 * order documented in src/skills/auto/references/routing-rules.md, and scores
 * predicted category vs the committed labels.
 *
 * This is a RATCHET, not an aspirational gate:
 *   - default mode : prints a report + overall accuracy, exit 0.
 *   - --check mode : exits NONZERO only if accuracy regresses > 2 points below
 *                    the committed baseline (scripts/eval/route-baseline.json).
 *                    It does NOT hard-fail on the 0.95 target — the deterministic
 *                    router is allowed to sit below target as long as it does not
 *                    get WORSE than the last committed run.
 *
 * First run (no baseline on disk) writes the baseline from the current accuracy,
 * so --check passes today and the number is captured for future comparison.
 *
 * No external deps. No network. No gh. Deterministic — same input => same output.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, '..', '..');
const BENCH_PATH = join(ROOT, 'src', 'skills', 'auto', 'routing-benchmark.json');
const BASELINE_PATH = join(SCRIPT_DIR, 'route-baseline.json');

// Regression tolerance: allow accuracy to drop by at most this fraction (2 points)
// below the committed baseline before --check fails.
const TOLERANCE = 0.02;

// The full known category set (matches the routing-benchmark labels + SKILL.md table).
const KNOWN_CATEGORIES = new Set([
  'build', 'cover', 'design', 'diagnose', 'fallback',
  'fix', 'improve-skill', 'optimize', 'review', 'verify',
]);

// ── Deterministic classifier ────────────────────────────────────────────────
// First matching rule wins. The ordering encodes the disambiguation priority
// from references/routing-rules.md §"Disambiguation":
//   1. explicit verb wins   2. metric+direction -> optimize
//   3. percentage in test ctx -> cover   4. question form -> design/diagnose
//   5. PR/MR/#N -> review    6. ticket ref -> build   7. else -> fallback (clarify)
//
// We front-load the strongest, least-ambiguous signals (skill target, verify,
// coverage, "why", design) so they win before the broader verb buckets.
function classify(rawGoal) {
  const g = String(rawGoal).toLowerCase();

  // 1. improve-skill — a SKILL.md / named skill is the optimization target.
  //    Must precede `optimize` ("optimize the prompt for the X skill").
  if (/skill\.md/.test(g) || /\bskills?\b/.test(g)) return 'improve-skill';

  // 2. verify — confirm existing state is green (verify/validate/make-sure/check-that).
  //    Precedes `build`/`review` so "validate the build" and "check that ..." resolve here.
  if (
    /\bverif(?:y|ies|ied)\b|\bvalidate\b/.test(g) ||
    /\bmake sure\b.*\b(pass|passes|work|works|green|clean)\b/.test(g) ||
    /\bcheck that\b.*\b(green|pass|passes|clean|type)\b/.test(g)
  ) return 'verify';

  // 3. cover — a coverage percentage or an "untested" surface. Precedes optimize/fix
  //    so "coverage above 90%" beats the `above` direction word and "untested, fix that"
  //    beats the `fix` verb.
  if (/\bcoverage\b|\buntested\b/.test(g)) return 'cover';

  // 4. diagnose — a "why …" question. Precedes optimize/fix/verify so
  //    "why is the test suite so slow" resolves to investigation, not optimize.
  if (/\bwhy\b/.test(g)) return 'diagnose';

  // 5. design — a design/architecture/exploration request or a comparison.
  //    "the design" (noun object, e.g. "implement the design") is NOT a design signal —
  //    that is a build. Precedes `build` so "design and build …" starts as design.
  const designVerb = /\bdesign\b/.test(g) && !/\bthe design\b/.test(g);
  if (
    designVerb ||
    /\barchitect(?:ure)?\b|\bhow should\b|\bhow do we\b|\bexplore\b|\bidea\b|think it through|think through|\bcompare\b|\bvs\.?\b/.test(g)
  ) return 'design';

  // 6. optimize — an explicit optimize verb, OR a direction word (reduce/minimize/
  //    below/under/above/faster/…), OR a metric noun paired with a number.
  const directionWord = /\breduce\b|\bminimi[sz]e\b|\bcut\b|\bbelow\b|\bunder\b|\babove\b|\bfaster\b|\bhalf\b|\bmaximi[sz]e\b|\bspeed up\b/.test(g);
  const metricNoun = /\blatency\b|\bbundle\b|\bthroughput\b|\bmemory\b|\bcold[- ]?start\b|\blighthouse\b|\bscore\b|\bp\d{2}\b|\bsize\b|\bminutes?\b|\bperformance\b/.test(g);
  if (/\boptimi[sz]e\b/.test(g) || directionWord || (metricNoun && /\d/.test(g))) return 'optimize';

  // 7. Documented ambiguity guard: "fix performance" with no concrete metric is the
  //    canonical fix-a-bug vs optimize-a-metric ambiguity (routing-rules.md §fix) → clarify.
  if (/\bfix\b/.test(g) && /\bperformance\b/.test(g) && !/\d/.test(g)) return 'fallback';

  // 8. fix — a repair verb or a broken/regression/error symptom. Precedes `review`
  //    so "fix issue #234" wins over the `#N` review signal (explicit verb wins).
  if (/\bfix\b|\brepair\b|\bresolve\b|\bbroken\b|\bregression\b|\bcrash(?:es|ing)?\b|\bfailing\b|\berrors?\b/.test(g)) return 'fix';

  // 9. build — a build/implement/create/add verb, or a ticket reference (PROJ-142).
  if (/\bbuild\b|\bimplement\b|\bcreate\b|\badd\b/.test(g) || /\b[a-z]{2,}-\d+\b/i.test(rawGoal)) return 'build';

  // 10. review — an explicit PR/MR/#N reference, or a review verb scoped to a branch.
  //     "review my code" (no artifact named) intentionally falls through to fallback.
  if (
    /\bpull request\b|\bmerge request\b|\bmr\b|\bpr\b|#\d+|![0-9]+/.test(g) ||
    (/\breview\b|\blook at\b/.test(g) && /\bbranch\b|changes on|this branch/.test(g))
  ) return 'review';

  // 11. Nothing cleared a confident threshold → clarify with one question.
  return 'fallback';
}

// ── Structure validation ────────────────────────────────────────────────────
function validateStructure(bench) {
  const errors = [];
  if (!bench || typeof bench !== 'object') errors.push('benchmark is not an object');
  if (!Array.isArray(bench.cases)) {
    errors.push('benchmark.cases is not an array');
    return errors;
  }
  const seenIds = new Set();
  bench.cases.forEach((c, i) => {
    const where = `case[${i}]${c && c.id ? ` (${c.id})` : ''}`;
    if (!c || typeof c !== 'object') { errors.push(`${where}: not an object`); return; }
    if (!c.id || typeof c.id !== 'string') errors.push(`${where}: missing/invalid 'id'`);
    else if (seenIds.has(c.id)) errors.push(`${where}: duplicate id '${c.id}'`);
    else seenIds.add(c.id);
    if (!c.goal || typeof c.goal !== 'string') errors.push(`${where}: missing/invalid 'goal'`);
    if (!c.category || typeof c.category !== 'string') errors.push(`${where}: missing/invalid 'category'`);
    else if (!KNOWN_CATEGORIES.has(c.category)) errors.push(`${where}: unknown category '${c.category}'`);
    if (!c.route || typeof c.route !== 'string') errors.push(`${where}: missing/invalid 'route'`);
  });
  return errors;
}

// ── Scoring ─────────────────────────────────────────────────────────────────
function score(bench) {
  const perCat = {};
  const misses = [];
  let correct = 0;
  for (const c of bench.cases) {
    const predicted = classify(c.goal);
    const ok = predicted === c.category;
    if (ok) correct++;
    else misses.push({ id: c.id, goal: c.goal, expected: c.category, predicted });
    const bucket = (perCat[c.category] ||= { correct: 0, total: 0 });
    bucket.total++;
    if (ok) bucket.correct++;
  }
  const total = bench.cases.length;
  const accuracy = total ? correct / total : 0;
  return { correct, total, accuracy, perCat, misses };
}

// ── Report ──────────────────────────────────────────────────────────────────
const log = (s = '') => process.stdout.write(s + '\n');

function printReport(result, target, baseline) {
  const pct = (n) => `${(n * 100).toFixed(1)}%`;
  log('Routing-accuracy check — /ork:auto deterministic classifier');
  log('='.repeat(60));
  log('Per-category accuracy:');
  for (const cat of [...Object.keys(result.perCat)].sort()) {
    const b = result.perCat[cat];
    const flag = b.correct === b.total ? '  ok ' : ' MISS';
    log(`  ${flag} ${cat.padEnd(14)} ${b.correct}/${b.total}  ${pct(b.correct / b.total)}`);
  }
  if (result.misses.length) {
    log('');
    log('Misclassifications:');
    for (const m of result.misses) {
      log(`  [${m.id}] expected=${m.expected} predicted=${m.predicted}`);
      log(`         "${m.goal}"`);
    }
  }
  log('');
  log(`Overall: ${result.correct}/${result.total} = ${pct(result.accuracy)}`);
  log(`Target : ${pct(target)} (aspirational; not enforced by --check)`);
  if (baseline) {
    log(`Baseline: ${pct(baseline.accuracy)} (committed ${baseline.generated_at || 'n/a'})`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
function main() {
  const checkMode = process.argv.includes('--check');

  let bench;
  try {
    bench = JSON.parse(readFileSync(BENCH_PATH, 'utf8'));
  } catch (e) {
    log(`ERROR: cannot read benchmark at ${BENCH_PATH}: ${e.message}`);
    process.exit(2);
  }

  const structErrors = validateStructure(bench);
  if (structErrors.length) {
    log(`ERROR: routing-benchmark.json failed structure validation (${structErrors.length}):`);
    for (const e of structErrors) log(`  - ${e}`);
    process.exit(2);
  }

  const target = typeof bench.target_accuracy === 'number' ? bench.target_accuracy : 0.95;
  const result = score(bench);

  // Load committed baseline if present.
  let baseline = null;
  if (existsSync(BASELINE_PATH)) {
    try { baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')); }
    catch (e) { log(`WARN: baseline unreadable (${e.message}); treating as absent.`); }
  }

  // First run: seed the baseline from the current accuracy so the ratchet has a floor.
  if (!baseline || typeof baseline.accuracy !== 'number') {
    baseline = {
      schema: 'ork-routing-baseline/1.0',
      description: 'Committed ratchet floor for /ork:auto routing accuracy. Regenerated only when accuracy improves or the benchmark changes intentionally. --check fails if accuracy drops > 2 points below this.',
      accuracy: result.accuracy,
      correct: result.correct,
      total: result.total,
      tolerance: TOLERANCE,
      target_accuracy: target,
      generated_at: new Date().toISOString().slice(0, 10),
    };
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
    printReport(result, target, baseline);
    log('');
    log(`Baseline seeded at ${(result.accuracy * 100).toFixed(1)}% -> ${BASELINE_PATH}`);
    log('PASS (baseline created; ratchet floor established).');
    process.exit(0);
  }

  const floor = baseline.accuracy - TOLERANCE;
  const regressed = result.accuracy < floor - 1e-9;

  if (!checkMode) {
    // Default mode: report only. Refresh the committed baseline UPWARD when the
    // classifier improves, so the ratchet tightens over time (never downward here).
    printReport(result, target, baseline);
    if (result.accuracy > baseline.accuracy + 1e-9) {
      const updated = {
        ...baseline,
        accuracy: result.accuracy,
        correct: result.correct,
        total: result.total,
        tolerance: TOLERANCE,
        target_accuracy: target,
        generated_at: new Date().toISOString().slice(0, 10),
      };
      writeFileSync(BASELINE_PATH, JSON.stringify(updated, null, 2) + '\n');
      log('');
      log(`Baseline ratcheted UP to ${(result.accuracy * 100).toFixed(1)}% -> ${BASELINE_PATH}`);
    }
    process.exit(0);
  }

  // --check mode: enforce the ratchet.
  printReport(result, target, baseline);
  log('');
  log(`Ratchet floor: ${((floor) * 100).toFixed(1)}% (baseline ${(baseline.accuracy * 100).toFixed(1)}% - ${(TOLERANCE * 100).toFixed(0)} pts)`);
  if (regressed) {
    log(`FAIL: accuracy ${(result.accuracy * 100).toFixed(1)}% regressed > ${(TOLERANCE * 100).toFixed(0)} points below baseline ${(baseline.accuracy * 100).toFixed(1)}%.`);
    log('Fix the classifier / benchmark drift, or intentionally re-baseline by running without --check.');
    process.exit(1);
  }
  log(`PASS: accuracy ${(result.accuracy * 100).toFixed(1)}% is within ${(TOLERANCE * 100).toFixed(0)} points of baseline ${(baseline.accuracy * 100).toFixed(1)}%.`);
  process.exit(0);
}

main();
