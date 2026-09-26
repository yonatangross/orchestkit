#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('../..', import.meta.url).pathname;
const doc = readFileSync(join(root, 'src/skills/analytics/references/otel-gateway-source.md'), 'utf8');
const blocks = [...doc.matchAll(/```bash\n([\s\S]*?)\n```/g)].map((match) => match[1]);
const discovery = blocks[1];
assert.ok(discovery, 'expected the second documented bash block');

const dir = mkdtempSync(join(tmpdir(), 'ork-gateway-discovery-'));
const log = join(dir, 'curl.jsonl');
writeFileSync(join(dir, 'curl'), `#!/usr/bin/env node
const { appendFileSync } = require('node:fs');
const args = process.argv.slice(2);
appendFileSync(process.env.CURL_LOG, JSON.stringify(args) + '\\n');
const url = args.find((arg) => arg.startsWith('http')) || '';
if (url.includes('/label/__name__/values')) process.stdout.write('{"data":["claude_code_cost_usage_USD_total"]}');
else if (url.endsWith('/labels')) process.stdout.write('{"data":["hq_lane","skill"]}');
else process.stdout.write(JSON.stringify({ data: { result: [{ values: [['1', JSON.stringify({ 'event.name': 'tool_result', attributes: { 'skill.name': 'analytics', query_source: 'SENTINEL_VALUE' } })]] }] } }));
`, { mode: 0o755 });

function run(env, block = discovery) {
  writeFileSync(log, '');
  const result = spawnSync('bash', ['-c', block], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ORK_OTEL_PROM_URL: '',
      ORK_OTEL_LOKI_URL: '',
      ORK_OTEL_LOKI_SELECTOR: '',
      ...env,
      PATH: `${dir}:${process.env.PATH}`,
      CURL_LOG: log,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return { calls: readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse), out: result.stdout };
}

try {
  assert.equal(run({}).calls.length, 0, 'no endpoints makes no calls');
  const prom = run({ ORK_OTEL_PROM_URL: 'https://prom.example' });
  assert.equal(prom.calls.length, 2, 'Prometheus makes exactly two discovery calls');
  assert.deepEqual(prom.calls.map((call) => call.at(-1)), [
    'https://prom.example/api/v1/label/__name__/values',
    'https://prom.example/api/v1/labels',
  ]);
  const noSelector = run({ ORK_OTEL_LOKI_URL: 'https://loki.example' });
  assert.equal(noSelector.calls.length, 0, 'Loki needs a selector');
  const selector = '{job="gateway"}';
  const loki = run({ ORK_OTEL_LOKI_URL: 'https://loki.example', ORK_OTEL_LOKI_SELECTOR: selector });
  const queryFlag = `${'-'}${'-data-urlencode'}`;
  assert.deepEqual(loki.calls, [[
    '-sG', 'https://loki.example/loki/api/v1/query_range', queryFlag, `query=${selector}`, queryFlag, 'limit=1',
  ]]);
  assert.match(loki.out, /event.name/);
  assert.match(loki.out, /skill.name/);
  assert.doesNotMatch(loki.out, /SENTINEL_VALUE/);
  const mutated = discovery.replace(' && [ -n "${ORK_OTEL_LOKI_SELECTOR:-}" ]', '');
  const mutant = run({ ORK_OTEL_LOKI_URL: 'https://loki.example' }, mutated);
  assert.equal(mutant.calls.length, 1, 'removing the selector guard makes the no-call case fail');
  console.log('analytics gateway discovery: 5 passed');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
